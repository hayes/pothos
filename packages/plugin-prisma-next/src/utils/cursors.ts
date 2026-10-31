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
      /** Placement in the forward order; nullable model fields default to last. */
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

/** Require a non-null unique key so equal sort values never disappear between pages. */
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

// Values are held in their column codec's stored form; nulls bypass codecs.
function encodeValues(fields: readonly string[], values: readonly unknown[], codecs: FieldCodecs) {
  const encoded = values.map((value, i) => {
    const codec = value == null ? undefined : codecs(fields[i]!);
    return codec ? codec.encode(value) : value;
  });
  return encoded.length === 1 ? encodeCursorChunk(encoded[0]) : encodeCursorTuple(encoded);
}

interface DecodeErrors {
  payload(): Error;
  width(got: number): Error;
  value(field: string): Error;
}

/** Keys come from `fields`, never the payload, so a payload can't inject `__proto__`. */
function decodeValues(
  fields: readonly string[],
  payload: string,
  codecs: FieldCodecs,
  errors: DecodeErrors,
): Record<string, unknown> {
  let decoded: unknown;
  try {
    decoded = decodeCursorChunk(payload);
  } catch {
    throw errors.payload();
  }
  // Dispatched on `fields`: a single JSON column can decode to an array too.
  const values = fields.length === 1 ? [decoded] : decoded;
  if (!Array.isArray(values) || values.length !== fields.length) {
    throw errors.width(Array.isArray(values) ? values.length : 1);
  }
  const out = Object.create(null) as Record<string, unknown>;
  fields.forEach((field, i) => {
    const codec = values[i] == null ? undefined : codecs(field);
    try {
      out[field] = codec ? codec.decode(values[i]) : values[i];
    } catch {
      throw errors.value(field);
    }
  });
  return out;
}

/**
 * Like plugin-prisma's `GPC:`; multi-column cursors are a positional `T:` tuple of chunks. The
 * ordering's signature follows the prefix, so a cursor only seeks under the ordering that issued
 * it: `PNC:<signature>:<chunk>`.
 */
const CURSOR_PREFIX = 'PNC:';

/**
 * Per cursor column, its direction (`a`/`d`) and any null placement (`f`/`l`): `adl` is `asc`, then
 * `desc` with nulls last. A request's `orderBy` can change both, and the same values seek a
 * different position under another ordering.
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
        // A null is a value; a missing column would encode as one and page from the wrong place.
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
 * `checkOrdering: false` accepts a cursor issued under any ordering, for a check made before a
 * request's `orderBy` is known; the page itself always checks it.
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
  const fields = cursorColumns(order);
  return decodeValues(fields, payload.slice(separator + 1), codecs, {
    payload: () =>
      new PothosValidationError('Invalid cursor: payload is not a tagged cursor chunk.'),
    width: (got) =>
      new PothosValidationError(
        `Invalid cursor: expected ${fields.length} value(s) for ${fields.join(', ')}, got ${got}.`,
      ),
    value: invalidCursorValue,
  });
}

function invalidCursorValue(field: string) {
  return new PothosValidationError(`Invalid cursor value for ${field}.`);
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
  let payload: string;
  try {
    payload = encodeValues(fields, values, codecs);
  } catch {
    throw new PothosValidationError(`prismaNode '${modelName}' row has an invalid id value.`);
  }
  // A string stays readable unless it could be mistaken for a tagged payload.
  return payload.startsWith('S:') && !payload.startsWith(`S:${ID_PREFIX}`)
    ? payload.slice(2)
    : `${ID_PREFIX}${payload}`;
}

/** The ID's values, as a tuple when `tuple` is set. */
export function parseNodeId(
  modelName: string,
  fields: readonly string[],
  id: string,
  codecs: FieldCodecs,
  tuple: boolean,
): unknown {
  const values = decodeValues(
    fields,
    id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : encodeCursorChunk(id),
    codecs,
    {
      payload: () => new PothosValidationError(`prismaNode '${modelName}' ID payload is invalid.`),
      width: (got) =>
        new PothosValidationError(
          `prismaNode '${modelName}' composite ID expected ${fields.length} values, got ${got}.`,
        ),
      value: (field) =>
        new PothosValidationError(`prismaNode '${modelName}' ID has an invalid ${field} value.`),
    },
  );
  return tuple ? fields.map((field) => values[field]) : values[fields[0]!];
}

// Lexicographic "row > cursor" as an OR-chain of equality-prefixed comparisons.
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
      // Null placement is independent of direction: a null boundary admits all non-null values
      // at this position or none.
      const includesNull = !!nulls && (op === 'gt') === (nulls === 'last');
      let comparison: unknown;
      if (v === null) {
        // Only a column with a null placement accepts a null boundary (`decodeBoundary`).
        comparison = includesNull
          ? and(col.isNull() as never, col.isNotNull() as never)
          : col.isNotNull();
      } else {
        const beyond = greater ? col.gt(v) : col.lt(v);
        comparison = includesNull ? or(beyond as never, col.isNull() as never) : beyond;
      }
      return equalities.length === 0
        ? comparison
        : and(...(equalities as never[]), comparison as never);
    });
    return clauses.length === 1 ? clauses[0] : or(...(clauses as never[]));
  };
}

export interface CursorPaginationParams {
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
  const { before, after, limit, expectedSize, inverted, hasPreviousPage, hasNextPage } =
    parseCursorConnectionArgs({
      args,
      ...(options.defaultSize !== undefined ? { defaultSize: options.defaultSize } : {}),
      ...(options.maxSize !== undefined ? { maxSize: options.maxSize } : {}),
    });
  return {
    cursor,
    before,
    after,
    limit,
    expectedSize,
    inverted,
    codecs: options.codecs,
    hasPreviousPage,
    hasNextPage,
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

/** Columns the request's `orderBy` doesn't name keep their default direction and nulls. */
function applyOrderByOption(
  base: MapperCollection,
  order: CursorOrder,
  orderBy: RequestOrderBy,
): CursorOrder {
  const cols = cursorColumns(order);
  let items: readonly OrderByItem[] = [];
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

/** A null can only mark a position on a column the validated spec gave a null placement. */
function decodeBoundary(
  order: CursorOrder,
  value: string,
  codecs: FieldCodecs,
  options?: { checkOrdering?: boolean },
): Record<string, unknown> {
  const boundary = decodeCursor(order, value, codecs, options);
  for (const { field, nulls } of order) {
    if (boundary[field] === null && !nulls) {
      throw invalidCursorValue(field);
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

  // Not `cursor()`: it takes one boundary in the order's direction and can't place nulls.
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
 * Throws what pagination would, without a collection. A request's `orderBy` needs a collection to
 * run, so with one (`checkOrdering: false`) the page checks the cursor's ordering instead.
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
    /** False seeks with a cursor from any ordering, for a caller that checks it afterwards. */
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

export interface PageInfo {
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
 * Cursors are encoded lazily (edge cursors are non-enumerable getters, `pageInfo`'s are
 * enumerable ones), so a selection without them skips encoding.
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
    // Lazy too, so a row whose cursor can't be encoded only fails a client that selects it.
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
