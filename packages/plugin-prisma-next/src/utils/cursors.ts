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
) => OrderByItem | readonly OrderByItem[];

export type CursorField =
  | string
  | {
      field: string;
      direction?: 'asc' | 'desc';
      /** Placement in the forward order; nullable model fields default to last. */
      nulls?: 'first' | 'last';
    };
export type CursorInput = CursorField | readonly CursorField[];

function cursorFields(cursor: CursorInput): readonly CursorField[] {
  return typeof cursor === 'string' || !Array.isArray(cursor) ? [cursor as CursorField] : cursor;
}

function fieldName(field: CursorField): string {
  return typeof field === 'string' ? field : field.field;
}

export function normalizeCursor(cursor: CursorInput): readonly string[] {
  return cursorFields(cursor).map(fieldName);
}

function cursorDirections(cursor: CursorInput): readonly ('asc' | 'desc')[] {
  return cursorFields(cursor).map((field) =>
    typeof field === 'string' ? 'asc' : (field.direction ?? 'asc'),
  );
}

const BYTES_CODEC = /\/(bytea|bytes|blob)@/;

/** Require a non-null unique key so equal sort values never disappear between pages. */
export function validateCursor(
  contract: AnyContract,
  modelName: string,
  cursor: CursorInput,
): CursorInput {
  const fields = normalizeCursor(cursor);
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
  return cursorFields(cursor).map((field) =>
    model.fields[fieldName(field)]!.nullable
      ? {
          ...(typeof field === 'string' ? { field } : field),
          nulls: typeof field === 'string' ? 'last' : (field.nulls ?? 'last'),
        }
      : field,
  );
}

/**
 * Bounds the work spent decoding user-supplied cursors and IDs. Measured on the string the
 * client sends back, and checked when encoding too, so the server never issues one it refuses.
 */
const PAYLOAD_MAX_LENGTH = 2 * 1024;

// Values are held in their column codec's stored form; nulls bypass codecs.
function encodeValues(fields: readonly string[], values: readonly unknown[], codecs: FieldCodecs) {
  const encoded = values.map((value, i) => {
    const codec = value == null ? undefined : codecs(fields[i]!);
    return codec ? codec.encode(value) : value;
  });
  return encoded.length === 1 ? encodeCursorChunk(encoded[0]) : encodeCursorTuple(encoded);
}

// Messages never echo the payload, which logs often capture verbatim.
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

/** Like plugin-prisma's `GPC:`; multi-column cursors are a positional `T:` tuple of chunks. */
const CURSOR_PREFIX = 'PNC:';

export function encodeCursor(
  cursor: CursorInput,
  row: Record<string, unknown>,
  codecs: FieldCodecs,
): string {
  const fields = normalizeCursor(cursor);
  const encoded = encodeBase64(
    `${CURSOR_PREFIX}${encodeValues(
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
  if (encoded.length > PAYLOAD_MAX_LENGTH) {
    throw new PothosValidationError(
      `Cannot encode a cursor over ${fields.join(', ')}: it is ${encoded.length} characters, over the ${PAYLOAD_MAX_LENGTH}-character limit for cursors. Use shorter cursor columns.`,
    );
  }
  return encoded;
}

export function decodeCursor(
  cursor: CursorInput,
  value: string,
  codecs: FieldCodecs,
): Record<string, unknown> {
  // The cursor is left out of messages, which logs often capture verbatim.
  if (value.length > PAYLOAD_MAX_LENGTH) {
    throw new PothosValidationError(
      `Invalid cursor: longer than ${PAYLOAD_MAX_LENGTH} characters.`,
    );
  }
  let payload: string;
  try {
    payload = decodeBase64(value);
  } catch {
    throw new PothosValidationError('Invalid cursor: not valid base64.');
  }
  if (!payload.startsWith(CURSOR_PREFIX)) {
    throw new PothosValidationError('Invalid cursor: not a cursor from this plugin.');
  }
  const fields = normalizeCursor(cursor);
  return decodeValues(fields, payload.slice(CURSOR_PREFIX.length), codecs, {
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
  const id =
    payload.startsWith('S:') && !payload.startsWith(`S:${ID_PREFIX}`)
      ? payload.slice(2)
      : `${ID_PREFIX}${payload}`;
  if (id.length > PAYLOAD_MAX_LENGTH) {
    throw new PothosValidationError(
      `prismaNode '${modelName}' ID is ${id.length} characters, over the ${PAYLOAD_MAX_LENGTH}-character limit for IDs it can load back.`,
    );
  }
  return id;
}

/** The ID's values, a tuple for a compound ID. */
export function parseNodeId(
  modelName: string,
  fields: readonly string[],
  id: string,
  codecs: FieldCodecs,
): unknown {
  if (id.length > PAYLOAD_MAX_LENGTH) {
    throw new PothosValidationError(
      `prismaNode '${modelName}' ID is longer than ${PAYLOAD_MAX_LENGTH} characters.`,
    );
  }
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
  return fields.length === 1 ? values[fields[0]!] : fields.map((field) => values[field]);
}

// Lexicographic "row > cursor" as an OR-chain of equality-prefixed comparisons.
function buildLexicographicPredicate(
  cols: readonly string[],
  values: Record<string, unknown>,
  op: 'gt' | 'lt',
  directions: readonly ('asc' | 'desc')[],
  nulls: readonly ('first' | 'last' | undefined)[],
): (c: Record<string, ComparableColumn>) => unknown {
  return (c) => {
    const clauses = cols.map((_, i) => {
      const equalities = cols
        .slice(0, i)
        .map((col) => (values[col] === null ? c[col]!.isNull() : c[col]!.eq(values[col])));
      const col = c[cols[i]!]!;
      const v = values[cols[i]!];
      const greater = (op === 'gt') !== (directions[i] === 'desc');
      // Null placement is independent of direction: a null boundary admits all non-null values
      // at this position or none.
      const includesNull = (op === 'gt') === (nulls[i] === 'last');
      const compFinal =
        nulls[i] && v === null
          ? includesNull
            ? and(col.isNull() as never, col.isNotNull() as never)
            : col.isNotNull()
          : nulls[i] && includesNull
            ? or((greater ? col.gt(v) : col.lt(v)) as never, col.isNull() as never)
            : greater
              ? col.gt(v)
              : col.lt(v);
      return equalities.length === 0
        ? compFinal
        : and(...(equalities as never[]), compFinal as never);
    });
    return clauses.length === 1 ? clauses[0] : or(...(clauses as never[]));
  };
}

export interface CursorPaginationParams {
  cursor: CursorInput;
  directions: readonly ('asc' | 'desc')[];
  cols: readonly string[];
  before: string | undefined;
  after: string | undefined;
  limit: number;
  expectedSize: number;
  inverted: boolean;
  codecs: FieldCodecs;
  hasNextPage: (resultSize: number) => boolean;
  hasPreviousPage: (resultSize: number) => boolean;
}

export interface CursorPaginationResult<C extends MapperCollection> extends CursorPaginationParams {
  collection: C;
}

export interface PaginationOptions {
  codecs: FieldCodecs;
  defaultSize?: number;
  maxSize?: number;
}

export function buildPaginationParams(
  cursor: CursorInput,
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
    directions: cursorDirections(cursor),
    cols: normalizeCursor(cursor),
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
  cursor: CursorInput,
  orderBy: RequestOrderBy,
): CursorInput {
  const fields = cursorFields(cursor);
  const cols = normalizeCursor(cursor);
  let items: readonly OrderByItem[] = [];
  base.orderBy((c: Record<string, ComparableColumn>) => {
    const selected = orderBy(c);
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
  return fields.map((field, i) => {
    const item = items[i];
    if (!item) {
      return field;
    }
    const spec = typeof field === 'string' ? { field } : field;
    const nulls = item.nulls ?? spec.nulls;
    return { ...spec, direction: item.dir, ...(nulls ? { nulls } : {}) };
  });
}

/** A null can only mark a position on a column the validated spec gave a null placement. */
function decodeBoundary(
  cursor: CursorInput,
  value: string,
  codecs: FieldCodecs,
): Record<string, unknown> {
  const boundary = decodeCursor(cursor, value, codecs);
  for (const field of cursorFields(cursor)) {
    const col = fieldName(field);
    if (boundary[col] === null && (typeof field === 'string' || !field.nulls)) {
      throw invalidCursorValue(col);
    }
  }
  return boundary;
}

function applyToCollection<C extends MapperCollection>(
  baseCollection: C,
  params: CursorPaginationParams,
): C {
  const { cols, cursor, directions, before, after, limit, inverted, codecs } = params;

  const nulls = cursorFields(cursor).map((field) =>
    typeof field === 'string' ? undefined : field.nulls,
  );
  const orderSelectors = cols.map((col, i) => (c: Record<string, ComparableColumn>) => {
    const forward = c[col]![directions[i]!](nulls[i] ? { nulls: nulls[i]! } : undefined);
    return inverted ? forward.reverse() : forward;
  });
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
        cols,
        decodeBoundary(cursor, after, codecs),
        'gt',
        directions,
        nulls,
      ),
    );
  }
  if (before) {
    collection = collection.where(
      buildLexicographicPredicate(
        cols,
        decodeBoundary(cursor, before, codecs),
        'lt',
        directions,
        nulls,
      ),
    );
  }
  return collection.limit(limit) as C;
}

/** Throws what pagination would, without a collection. */
export function validateCursorArgs(
  cursor: CursorInput,
  args: PothosSchemaTypes.DefaultConnectionArguments,
  codecs: FieldCodecs,
): void {
  const { before, after } = buildPaginationParams(cursor, args, { codecs });
  if (after) {
    decodeBoundary(cursor, after, codecs);
  }
  if (before) {
    decodeBoundary(cursor, before, codecs);
  }
}

export function applyCursorPagination<C extends MapperCollection>(
  baseCollection: C,
  cursor: CursorInput,
  args: PothosSchemaTypes.DefaultConnectionArguments,
  options: PaginationOptions & { orderBy?: RequestOrderBy | undefined },
): CursorPaginationResult<C> {
  assertUnpaginatedCollection(baseCollection);
  const params = buildPaginationParams(
    options.orderBy ? applyOrderByOption(baseCollection, cursor, options.orderBy) : cursor,
    args,
    options,
  );
  return {
    ...params,
    collection: applyToCollection(baseCollection, params),
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

/** Edge cursors are lazy, non-enumerable getters, so selecting only `nodes` skips encoding. */
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
    pageInfo: {
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
      hasPreviousPage: pagination.hasPreviousPage(rows.length),
      hasNextPage: pagination.hasNextPage(rows.length),
    },
    ...(totalCount === undefined ? {} : { totalCount }),
  };
}
