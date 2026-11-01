import {
  decodeBase64,
  decodeCursorChunk,
  encodeBase64,
  encodeCursorChunk,
  encodeCursorTuple,
  PothosSchemaError,
  PothosValidationError,
  parseCursorConnectionArgs,
} from '@pothos/core';
import { deepEqual } from '@pothos/selection-mapper';
import { and, or } from '@prisma/orm-family-sql/orm-client';
import { type AnyExpression, OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import type { AnyContract } from '../types.js';
import type { MapperCollection } from './adapter.js';
import { getCollectionPaginationState } from './collection-state.js';
import { resolveContractModel } from './contract.js';
import { type FieldCodecs, getModelUniqueKeys } from './model.js';

// The subset of orm-client's `ModelAccessor` used here, without its contract generics.
interface ComparableColumn {
  eq(v: unknown): unknown;
  gt(v: unknown): unknown;
  lt(v: unknown): unknown;
  isNull(): AnyExpression;
  isNotNull(): unknown;
  asc(options?: { nulls?: 'first' | 'last' }): OrderByItem;
  desc(options?: { nulls?: 'first' | 'last' }): OrderByItem;
}

export type RequestOrderBy = (
  model: Record<string, ComparableColumn>,
  tools: unknown,
) => OrderByItem | readonly OrderByItem[];

type CursorField =
  | string
  | {
      field: string;
      direction?: 'asc' | 'desc';
      /** Where nulls sort in the forward order. Nullable fields default to last. */
      nulls?: 'first' | 'last';
    };
export type CursorInput = CursorField | readonly CursorField[];

/** A cursor column as `validateCursor` returns it. */
interface CursorColumnOrder {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
  readonly nulls?: 'first' | 'last';
}

export type CursorOrder = readonly CursorColumnOrder[];

export const cursorColumns = (order: CursorOrder): string[] => order.map(({ field }) => field);

const BYTES_CODEC = /\/(bytea|bytes|blob)@/;

/**
 * Validates a cursor spec. The cursor must cover a non-null unique key, so rows with equal sort
 * values are never skipped between pages.
 */
export function validateCursor(
  contract: AnyContract,
  modelName: string,
  cursor: CursorInput,
): CursorOrder {
  const entries = (Array.isArray(cursor) ? cursor : [cursor]) as readonly CursorField[];
  const columns = entries.map((entry) => (typeof entry === 'string' ? { field: entry } : entry));
  const fields = columns.map(({ field }) => field);
  if (!fields.length || new Set(fields).size !== fields.length) {
    throw new PothosSchemaError(
      'A connection cursor must contain distinct columns and cannot be empty.',
    );
  }
  const model = resolveContractModel(contract, modelName);
  const keys = getModelUniqueKeys(contract, modelName);
  if (!model || !keys) {
    throw new PothosSchemaError(
      `Connection cursor requires SQL storage metadata for model '${modelName}'.`,
    );
  }
  for (const field of fields) {
    if (!model.fields[field]) {
      throw new PothosSchemaError(
        `Connection cursor '${modelName}.${field}' must be a model field.`,
      );
    }
    const type = model.fields[field].type as { codecId?: string } | undefined;
    if (type?.codecId && BYTES_CODEC.test(type.codecId)) {
      throw new PothosSchemaError(
        `Connection cursor '${modelName}.${field}' is a bytes column, which the ORM can't order. Use a different cursor column.`,
      );
    }
  }
  const selected = new Set(fields);
  if (!keys.some((key) => key.every((field) => selected.has(field)))) {
    throw new PothosSchemaError(
      `Connection cursor for '${modelName}' must include every field of a non-null primary or unique key. Add a unique tie-breaker such as id.`,
    );
  }
  return columns.map(({ field, direction = 'asc', nulls }) => {
    const placement = nulls ?? (model.fields[field]!.nullable ? 'last' : undefined);
    return placement ? { field, direction, nulls: placement } : { field, direction };
  });
}

// Values are encoded in their column codec's stored form. Nulls skip the codec.
function encodeValues(fields: readonly string[], values: readonly unknown[], codecs: FieldCodecs) {
  const encoded = values.map((value, i) => {
    const codec = value == null ? undefined : codecs(fields[i]!);
    return codec ? codec.encode(value) : value;
  });
  return encoded.length === 1 ? encodeCursorChunk(encoded[0]) : encodeCursorTuple(encoded);
}

/** A decoding failure. Each caller turns it into an error with its own wording. */
class DecodeError extends Error {}

function decodeValues(
  fields: readonly string[],
  payload: string,
  codecs: FieldCodecs,
): Record<string, unknown> {
  let decoded: unknown;
  try {
    decoded = decodeCursorChunk(payload);
  } catch {
    throw new DecodeError('malformed payload');
  }
  // Checked against `fields` rather than the decoded shape, as a JSON column can hold an array.
  const values = fields.length === 1 ? [decoded] : decoded;
  if (!Array.isArray(values) || values.length !== fields.length) {
    throw new DecodeError(
      `expected ${fields.length} value(s), got ${Array.isArray(values) ? values.length : 1}`,
    );
  }
  const out: Record<string, unknown> = {};
  fields.forEach((field, i) => {
    const codec = values[i] == null ? undefined : codecs(field);
    try {
      out[field] = codec ? codec.decode(values[i]) : values[i];
    } catch {
      throw new DecodeError(`invalid ${field} value`);
    }
  });
  return out;
}

function rethrowDecodeError(error: unknown, prefix: string): never {
  throw error instanceof DecodeError
    ? new PothosValidationError(`${prefix}: ${error.message}.`)
    : error;
}

/**
 * Cursors have the form `PNC:<signature>:<chunk>`, and a multi-column cursor's chunk is a `T:`
 * tuple. The signature records the ordering that issued the cursor, so the cursor is only
 * accepted under that ordering.
 */
const CURSOR_PREFIX = 'PNC:';

/**
 * Encodes each cursor column's direction (`a` or `d`) and null placement (`f`, `l` or none), so
 * `adl` means `asc`, then `desc` with nulls last. A request's `orderBy` can change both, and the
 * same values point to a different position under another ordering.
 */
function orderingSignature(order: CursorOrder): string {
  return order.map(({ direction, nulls }) => `${direction[0]}${nulls?.[0] ?? ''}`).join('');
}

function encodeCursor(order: CursorOrder, row: Record<string, unknown>, codecs: FieldCodecs) {
  const fields = cursorColumns(order);
  return encodeBase64(
    `${CURSOR_PREFIX}${orderingSignature(order)}:${encodeValues(
      fields,
      fields.map((field) => {
        // A missing column would encode as null and page from the wrong position.
        if (row[field] === undefined) {
          throw new PothosValidationError(
            `Cannot encode a cursor: the row is missing cursor column '${field}'. Select the cursor columns on the paginated collection.`,
          );
        }
        return row[field];
      }),
      codecs,
    )}`,
  );
}

/**
 * With `checkOrdering: false`, a cursor issued under any ordering is accepted. Callers pass it
 * before the request's `orderBy` is known and check the ordering once it is.
 */
function decodeCursor(
  order: CursorOrder,
  value: string,
  codecs: FieldCodecs,
  { checkOrdering = true }: { checkOrdering?: boolean } = {},
): Record<string, unknown> {
  // Messages never echo the payload, which logs often capture verbatim.
  let payload: string;
  try {
    payload = decodeBase64(value);
  } catch {
    throw new PothosValidationError('Invalid cursor: not valid base64.');
  }
  if (!payload.startsWith(CURSOR_PREFIX)) {
    throw new PothosValidationError('Invalid cursor: not a cursor from this plugin.');
  }
  const separator = payload.indexOf(':', CURSOR_PREFIX.length);
  const signature = payload.slice(CURSOR_PREFIX.length, separator);
  if (separator === -1 || !/^(?:[ad][fl]?)+$/.test(signature)) {
    throw new PothosValidationError('Invalid cursor: payload is not a tagged cursor chunk.');
  }
  if (checkOrdering && signature !== orderingSignature(order)) {
    throw new PothosValidationError(
      'Invalid cursor: it was issued under a different ordering of this connection. Request the first page again with the new ordering.',
    );
  }
  try {
    return decodeValues(cursorColumns(order), payload.slice(separator + 1), codecs);
  } catch (error) {
    return rethrowDecodeError(error, 'Invalid cursor');
  }
}

/** Tags node IDs that aren't plain strings, so they decode back to their own type. */
const ID_PREFIX = 'PNI:';

export function encodeNodeId(
  modelName: string,
  fields: readonly string[],
  row: Record<string, unknown>,
  codecs: FieldCodecs,
): string {
  const values = fields.map((field) => {
    if (row[field] == null) {
      throw new PothosValidationError(
        `prismaNode '${modelName}' row is missing id field '${field}'.`,
      );
    }
    return row[field];
  });
  const payload = encodeValues(fields, values, codecs);
  // A string stays readable unless it could be mistaken for a tagged payload.
  return payload.startsWith('S:') && !payload.startsWith(`S:${ID_PREFIX}`)
    ? payload.slice(2)
    : `${ID_PREFIX}${payload}`;
}

/** Decodes a node ID. Returns a tuple of the values of `fields` when `tuple` is set. */
export function parseNodeId(
  modelName: string,
  fields: readonly string[],
  id: string,
  codecs: FieldCodecs,
  { tuple }: { tuple: boolean },
): unknown {
  let values: Record<string, unknown>;
  try {
    values = decodeValues(
      fields,
      id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : encodeCursorChunk(id),
      codecs,
    );
  } catch (error) {
    return rethrowDecodeError(error, `Invalid prismaNode '${modelName}' ID`);
  }
  return tuple ? fields.map((field) => values[field]) : values[fields[0]!];
}

// Compares rows with the cursor lexicographically. Each OR clause requires the earlier columns to
// equal the cursor's values and compares the next column.
function buildLexicographicPredicate(
  order: CursorOrder,
  values: Record<string, unknown>,
  op: 'gt' | 'lt',
): (c: Record<string, ComparableColumn>) => unknown {
  return (c) => {
    const clauses = order.map(({ field, direction, nulls }, i) => {
      const equalities = order
        .slice(0, i)
        .map(({ field: prev }) =>
          values[prev] === null ? c[prev]!.isNull() : c[prev]!.eq(values[prev]),
        );
      const col = c[field]!;
      const v = values[field];
      const greater = (op === 'gt') !== (direction === 'desc');
      // Whether nulls sort beyond the boundary. Null placement doesn't change with direction.
      const nullsBeyond = !!nulls && (op === 'gt') === (nulls === 'last');
      let comparison: unknown;
      if (v === null) {
        // Nothing lies beyond a null boundary when nulls sort beyond it, and every non-null row
        // does otherwise. `decodeBoundary` only accepts a null on a column with a null placement.
        comparison = nullsBeyond
          ? and(col.isNull() as never, col.isNotNull() as never)
          : col.isNotNull();
      } else {
        const beyond = greater ? col.gt(v) : col.lt(v);
        comparison = nullsBeyond ? or(beyond as never, col.isNull() as never) : beyond;
      }
      return equalities.length === 0
        ? comparison
        : and(...(equalities as never[]), comparison as never);
    });
    return clauses.length === 1 ? clauses[0] : or(...(clauses as never[]));
  };
}

interface CursorPaginationParams {
  cursor: CursorOrder;
  before: string | undefined;
  after: string | undefined;
  limit: number;
  expectedSize: number;
  inverted: boolean;
  codecs: FieldCodecs;
  hasNextPage: (resultSize: number) => boolean;
  hasPreviousPage: (resultSize: number) => boolean;
}

interface CursorPaginationResult<C extends MapperCollection> extends CursorPaginationParams {
  collection: C;
}

interface PaginationOptions {
  codecs: FieldCodecs;
  defaultSize?: number;
  maxSize?: number;
}

export function buildPaginationParams(
  cursor: CursorOrder,
  args: PothosSchemaTypes.DefaultConnectionArguments,
  options: PaginationOptions,
): CursorPaginationParams {
  return {
    ...parseCursorConnectionArgs({
      args,
      defaultSize: options.defaultSize,
      maxSize: options.maxSize,
    }),
    cursor,
    codecs: options.codecs,
  };
}

/** Connection bases may be ordered, but cannot carry a limit, offset, cursor, or distinct. */
export function assertUnpaginatedCollection(collection: unknown): void {
  const { paginated, distinct } = getCollectionPaginationState(collection);
  if (paginated) {
    throw new PothosValidationError(
      'Connection resolvers must return an unpaginated Collection without cursor(), limit(), or offset().',
    );
  }
  if (distinct) {
    throw new PothosValidationError(
      'Connection resolvers cannot return a Collection with distinct() or distinctOn(): the rows a page keeps would depend on the columns the selection adds.',
    );
  }
}

/**
 * Applies a request's `orderBy` to the cursor ordering. Columns it doesn't name keep their default
 * direction and null placement.
 */
function applyOrderByOption(
  base: MapperCollection,
  order: CursorOrder,
  orderBy: RequestOrderBy,
): CursorOrder {
  const cols = cursorColumns(order);
  let items: readonly OrderByItem[] = [];
  // Called only to run the callback with the ORM's column accessors. The result is discarded.
  base.orderBy((c: Record<string, ComparableColumn>, tools: unknown) => {
    const selected = orderBy(c, tools);
    items = selected instanceof OrderByItem ? [selected] : selected;
    if (
      items.length > cols.length ||
      items.some(
        (item, i) =>
          !(item instanceof OrderByItem) || !deepEqual(item.expr, c[cols[i]!]!.asc().expr),
      )
    ) {
      throw new PothosValidationError(
        `Connection orderBy must order by the cursor's columns in cursor order (${cols.join(', ')}).`,
      );
    }
    return c[cols[0]!]!.asc();
  });
  return order.map((column, i) => {
    const item = items[i];
    if (!item) {
      return column;
    }
    const nulls = item.nulls ?? column.nulls;
    return { field: column.field, direction: item.dir, ...(nulls ? { nulls } : {}) };
  });
}

/** Decodes a cursor boundary. A null is only valid on a column with a null placement. */
function decodeBoundary(
  order: CursorOrder,
  value: string,
  codecs: FieldCodecs,
  options?: { checkOrdering?: boolean },
): Record<string, unknown> {
  const boundary = decodeCursor(order, value, codecs, options);
  for (const { field, nulls } of order) {
    if (boundary[field] === null && !nulls) {
      throw new PothosValidationError(`Invalid cursor: invalid ${field} value.`);
    }
  }
  return boundary;
}

function applyToCollection<C extends MapperCollection>(
  baseCollection: C,
  params: CursorPaginationParams,
  checkOrdering: boolean,
): C {
  const { cursor, before, after, limit, inverted, codecs } = params;

  const orderSelectors = cursor.map(
    ({ field, direction, nulls }) =>
      (c: Record<string, ComparableColumn>) => {
        const forward = c[field]![direction](nulls ? { nulls } : undefined);
        return inverted ? forward.reverse() : forward;
      },
  );
  // orderBy() appends and can't be reset, so only the entries missing from the existing
  // prefix are added.
  const existing = getCollectionPaginationState(baseCollection).orderBy;
  const ordered = baseCollection.orderBy(
    orderSelectors.length === 1 ? orderSelectors[0]! : orderSelectors,
  );
  const expected = getCollectionPaginationState(ordered).orderBy.slice(existing.length);
  if (
    existing.length > expected.length ||
    existing.some((item, i) => !(item instanceof OrderByItem) || !deepEqual(item, expected[i]))
  ) {
    throw new PothosValidationError(
      'Connection Collection orderBy() must match a prefix of the cursor ordering for this page direction. Backward pagination requires reversed ordering; return an unordered Collection to support both directions.',
    );
  }
  const withOrder =
    existing.length === 0
      ? ordered
      : existing.length === expected.length
        ? baseCollection
        : baseCollection.orderBy(orderSelectors.slice(existing.length));

  // The ORM's `cursor()` takes one boundary in the order's direction and can't place nulls, so
  // the boundaries are applied as filters.
  let collection: MapperCollection = withOrder;
  if (after) {
    collection = collection.where(
      buildLexicographicPredicate(
        cursor,
        decodeBoundary(cursor, after, codecs, { checkOrdering }),
        'gt',
      ),
    );
  }
  if (before) {
    collection = collection.where(
      buildLexicographicPredicate(
        cursor,
        decodeBoundary(cursor, before, codecs, { checkOrdering }),
        'lt',
      ),
    );
  }
  return collection.limit(limit) as C;
}

/**
 * Throws what pagination would throw for `args`, without a collection. A request's `orderBy` can
 * only run against a collection, so a caller that has one passes `checkOrdering: false` here and
 * checks the ordering later.
 */
export function validateCursorArgs(
  cursor: CursorOrder,
  args: PothosSchemaTypes.DefaultConnectionArguments,
  codecs: FieldCodecs,
  options?: { checkOrdering?: boolean },
): void {
  const { before, after } = buildPaginationParams(cursor, args, { codecs });
  if (after) {
    decodeBoundary(cursor, after, codecs, options);
  }
  if (before) {
    decodeBoundary(cursor, before, codecs, options);
  }
}

export function applyCursorPagination<C extends MapperCollection>(
  baseCollection: C,
  cursor: CursorOrder,
  args: PothosSchemaTypes.DefaultConnectionArguments,
  options: PaginationOptions & {
    orderBy?: RequestOrderBy | undefined;
    /** False accepts a cursor from any ordering. The caller then checks the ordering itself. */
    checkOrdering?: boolean;
  },
): CursorPaginationResult<C> {
  assertUnpaginatedCollection(baseCollection);
  const params = buildPaginationParams(
    options.orderBy ? applyOrderByOption(baseCollection, cursor, options.orderBy) : cursor,
    args,
    options,
  );
  return {
    ...params,
    collection: applyToCollection(baseCollection, params, options.checkOrdering ?? true),
  };
}

interface PageInfo {
  startCursor: string | null;
  endCursor: string | null;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ConnectionPage<Row> {
  edges: Array<{ node: Row; cursor: string }>;
  pageInfo: PageInfo;
  totalCount?: number;
}

/**
 * Cursors are encoded lazily, so a selection without them encodes nothing. Edge cursors are
 * non-enumerable getters and the `pageInfo` cursors are enumerable getters.
 */
export function buildConnectionPage<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  pagination: CursorPaginationParams,
  totalCount?: number,
): ConnectionPage<Row> {
  const needsCopy = pagination.inverted || rows.length > pagination.expectedSize;
  const trimmed: Row[] = needsCopy ? rows.slice(0, pagination.expectedSize) : (rows as Row[]);
  const ordered = pagination.inverted ? trimmed.reverse() : trimmed;

  const edges = ordered.map((node) => {
    let cached: string | undefined;
    const edge = { node } as { node: Row; cursor: string };
    Object.defineProperty(edge, 'cursor', {
      enumerable: false,
      configurable: true,
      get() {
        cached ??= encodeCursor(pagination.cursor, node, pagination.codecs);
        return cached;
      },
    });
    return edge;
  });

  return {
    edges,
    // Lazy as well, so a row whose cursor can't be encoded only fails a client that selects it.
    pageInfo: {
      get startCursor() {
        return edges[0]?.cursor ?? null;
      },
      get endCursor() {
        return edges[edges.length - 1]?.cursor ?? null;
      },
      hasPreviousPage: pagination.hasPreviousPage(rows.length),
      hasNextPage: pagination.hasNextPage(rows.length),
    },
    ...(totalCount === undefined ? {} : { totalCount }),
  };
}
