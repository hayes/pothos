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
import { OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import type { AnyContract } from '../types.js';
import type { MapperCollection } from './adapter.js';
import { getCollectionPaginationState } from './collection-state.js';
import { resolveContractModel } from './contract.js';
import {
  type ColumnCodec,
  getColumnCodec,
  getModelUniqueKeys,
  type PrismaNextCodecContext,
} from './model.js';

// The subset of orm-client's `ModelAccessor` used here, without its contract generics.
interface ComparableColumn {
  eq(v: unknown): unknown;
  gt(v: unknown): unknown;
  lt(v: unknown): unknown;
  isNull(): import('@prisma/orm-family-sql/relational-core/ast').AnyExpression;
  isNotNull(): unknown;
  asc(options?: { nulls?: 'first' | 'last' }): OrderByItem;
  desc(options?: { nulls?: 'first' | 'last' }): OrderByItem;
}

export type RequestOrderBy = (
  model: Record<string, ComparableColumn>,
) => OrderByItem | readonly OrderByItem[];

/** For object-valued columns such as Temporal or Decimal values. */
export interface CursorValueCodec<Value = unknown> {
  encode(value: Value): string;
  decode(value: string): Value;
}

export type CursorField =
  | string
  | {
      field: string;
      direction?: 'asc' | 'desc';
      /** Placement in the forward order; nullable model fields default to last. */
      nulls?: 'first' | 'last';
      /** `'column'` uses the column's codec from `prismaNext.context`. */
      codec?: CursorValueCodec | 'column';
      /** @internal Filled in by `validateCursor` when the plugin has the client's `context`. */
      columnCodec?: ColumnCodec;
    };
export type CursorInput = CursorField | readonly CursorField[];

function cursorFields(cursor: CursorInput): readonly CursorField[] {
  return typeof cursor === 'string' || !Array.isArray(cursor) ? [cursor as CursorField] : cursor;
}

export function normalizeCursor(cursor: CursorInput): readonly string[] {
  return cursorFields(cursor).map((field) => (typeof field === 'string' ? field : field.field));
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
  context?: PrismaNextCodecContext,
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
  }
  for (const field of fields) {
    const type = model.fields[field]!.type as { codecId?: string } | undefined;
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
  return cursorFields(cursor).map((field) => {
    const name = typeof field === 'string' ? field : field.field;
    const columnCodec = getColumnCodec(contract, modelName, name, context);
    const nullable = model.fields[name]!.nullable;
    if (typeof field !== 'string' && field.codec === 'column' && !columnCodec) {
      throw new PothosSchemaError(
        `Connection cursor '${modelName}.${name}' uses codec: 'column', which requires prismaNext.context.`,
      );
    }
    return nullable || columnCodec
      ? {
          ...(typeof field === 'string' ? { field } : field),
          ...(nullable
            ? { nulls: typeof field === 'string' ? 'last' : (field.nulls ?? 'last') }
            : {}),
          ...(columnCodec ? { columnCodec } : {}),
        }
      : field;
  });
}

/** Like plugin-prisma's `GPC:`; multi-column cursors are a positional `T:` tuple of chunks. */
const CURSOR_PREFIX = 'PNC:';

/** Wrapped so a codec's encoded form can't be mistaken for a JSON column's value. */
const COLUMN_CODEC_KEY = '$pothosColumnValue';

function isClassInstance(value: unknown): value is object {
  if (!value || typeof value !== 'object' || value instanceof Date || value instanceof Uint8Array) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto !== null && proto !== Object.prototype && !Array.isArray(value);
}

function encodeCursorValue(field: CursorField, value: unknown): unknown {
  const spec = typeof field === 'string' ? { field } : field;
  if (value === null || value === undefined) {
    return value;
  }
  if (spec.codec && spec.codec !== 'column') {
    return spec.codec.encode(value as never);
  }
  if (!isClassInstance(value)) {
    return value;
  }
  if (spec.columnCodec) {
    return { [COLUMN_CODEC_KEY]: spec.columnCodec.toStored(value) };
  }
  // The shared encoding keeps a decimal's digits; any other object couldn't start the next page.
  if (typeof (value as { toFixed?: unknown }).toFixed !== 'function') {
    throw new PothosValidationError(
      `Cursor column '${spec.field}' holds an object value. Set prismaNext.context, or give the column an explicit codec.`,
    );
  }
  return value;
}

export function encodeCursor(cursor: CursorInput, row: Record<string, unknown>): string {
  const values = cursorFields(cursor).map((field) =>
    encodeCursorValue(field, row[typeof field === 'string' ? field : field.field]),
  );
  const payload = values.length === 1 ? encodeCursorChunk(values[0]) : encodeCursorTuple(values);

  return encodeBase64(`${CURSOR_PREFIX}${payload}`);
}

/** @internal Bounds the work spent decoding user-supplied cursors and IDs. */
export const CURSOR_PAYLOAD_MAX_BYTES = 2 * 1024;

/** Keys come from `cols`, never the payload, so a cursor can't inject `__proto__`. */
export function decodeCursor(spec: CursorInput, cursor: string): Record<string, unknown> {
  const cols = normalizeCursor(spec);
  if (cursor.length > CURSOR_PAYLOAD_MAX_BYTES) {
    throw new PothosValidationError(
      `Invalid cursor: payload exceeds ${CURSOR_PAYLOAD_MAX_BYTES} bytes.`,
    );
  }

  let payload: string;
  try {
    payload = decodeBase64(cursor);
  } catch {
    // The cursor is left out of the message, which logs often capture verbatim.
    throw new PothosValidationError('Invalid cursor: not valid base64.');
  }

  if (!payload.startsWith(CURSOR_PREFIX)) {
    throw new PothosValidationError('Invalid cursor: not a cursor from this plugin.');
  }

  let decoded: unknown;
  try {
    decoded = decodeCursorChunk(payload.slice(CURSOR_PREFIX.length));
  } catch {
    throw new PothosValidationError('Invalid cursor: payload is not a tagged cursor chunk.');
  }

  // Dispatched on `cols`: a single JSON column can decode to an array too.
  const values = cols.length === 1 ? [decoded] : decoded;

  if (!Array.isArray(values) || values.length !== cols.length) {
    throw new PothosValidationError(
      `Invalid cursor: expected ${cols.length} value(s) for ${cols.join(', ')}, got ${
        Array.isArray(values) ? values.length : 1
      }.`,
    );
  }

  const out = Object.create(null) as Record<string, unknown>;

  cursorFields(spec).forEach((field, i) => {
    const col = typeof field === 'string' ? field : field.field;
    try {
      if (
        values[i] !== null &&
        typeof field !== 'string' &&
        field.codec &&
        field.codec !== 'column'
      ) {
        if (typeof values[i] !== 'string') {
          throw new Error('Codec cursor must contain a string');
        }
        out[col] = field.codec.decode(values[i]);
      } else if (
        typeof field !== 'string' &&
        field.columnCodec &&
        values[i] &&
        typeof values[i] === 'object' &&
        Object.hasOwn(values[i], COLUMN_CODEC_KEY)
      ) {
        out[col] = field.columnCodec.fromStored(values[i][COLUMN_CODEC_KEY]);
      } else {
        out[col] = values[i];
      }
    } catch {
      throw new PothosValidationError(`Invalid cursor value for ${col}.`);
    }
  });

  return out;
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
  hasNextPage: (resultSize: number) => boolean;
  hasPreviousPage: (resultSize: number) => boolean;
}

export interface CursorPaginationResult<C extends MapperCollection> extends CursorPaginationParams {
  collection: C;
  encodeRowCursor: (row: Record<string, unknown>) => string;
}

export function buildPaginationParams(
  cursor: CursorInput,
  args: import('@pothos/plugin-relay').DefaultConnectionArguments,
  options?: { defaultSize?: number; maxSize?: number },
): CursorPaginationParams & { encodeRowCursor: (row: Record<string, unknown>) => string } {
  const cols = normalizeCursor(cursor);
  if (!cols.length || new Set(cols).size !== cols.length) {
    throw new PothosValidationError(
      'A connection cursor must contain distinct columns and cannot be empty.',
    );
  }
  const { before, after, limit, expectedSize, inverted, hasPreviousPage, hasNextPage } =
    parseCursorConnectionArgs({
      args,
      ...(options?.defaultSize !== undefined ? { defaultSize: options.defaultSize } : {}),
      ...(options?.maxSize !== undefined ? { maxSize: options.maxSize } : {}),
    });
  return {
    cursor,
    directions: cursorDirections(cursor),
    cols,
    before,
    after,
    limit,
    expectedSize,
    inverted,
    hasPreviousPage,
    hasNextPage,
    encodeRowCursor: (row) => encodeCursor(cursor, row),
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
function decodeBoundary(cursor: CursorInput, value: string): Record<string, unknown> {
  const boundary = decodeCursor(cursor, value);
  for (const field of cursorFields(cursor)) {
    const col = typeof field === 'string' ? field : field.field;
    if (boundary[col] === null && (typeof field === 'string' || !field.nulls)) {
      throw new PothosValidationError(`Invalid cursor value for ${col}.`);
    }
  }
  return boundary;
}

function applyToCollection<C extends MapperCollection>(
  baseCollection: C,
  params: CursorPaginationParams,
): C {
  const { cols, cursor, directions, before, after, limit, inverted } = params;

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

  const dualBound = !!before && !!after;
  const nativeAfter = !!after && !before && !inverted;
  const nativeBefore = !!before && !after && inverted;

  if (!nulls.some(Boolean) && !dualBound && (nativeAfter || nativeBefore)) {
    const boundary = decodeBoundary(cursor, nativeAfter ? after! : before!);
    return withOrder.cursor(boundary).limit(limit) as C;
  }

  // `cursor()` takes one boundary in the order's direction; anything else needs a predicate.
  let collection: MapperCollection = withOrder;
  if (after) {
    collection = collection.where(
      buildLexicographicPredicate(cols, decodeBoundary(cursor, after), 'gt', directions, nulls),
    );
  }
  if (before) {
    collection = collection.where(
      buildLexicographicPredicate(cols, decodeBoundary(cursor, before), 'lt', directions, nulls),
    );
  }
  return collection.limit(limit) as C;
}

/** Throws what pagination would, without a collection. */
export function validateCursorArgs(
  cursor: CursorInput,
  args: import('@pothos/plugin-relay').DefaultConnectionArguments,
): void {
  const { before, after } = buildPaginationParams(cursor, args);
  if (after) {
    decodeBoundary(cursor, after);
  }
  if (before) {
    decodeBoundary(cursor, before);
  }
}

export function applyCursorPagination<C extends MapperCollection>(
  baseCollection: C,
  cursor: CursorInput,
  args: import('@pothos/plugin-relay').DefaultConnectionArguments,
  options?: { defaultSize?: number; maxSize?: number; orderBy?: RequestOrderBy | undefined },
): CursorPaginationResult<C> {
  assertUnpaginatedCollection(baseCollection);
  const params = buildPaginationParams(
    options?.orderBy ? applyOrderByOption(baseCollection, cursor, options.orderBy) : cursor,
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
}

/** Edge cursors are lazy, non-enumerable getters, so selecting only `nodes` skips encoding. */
export function buildConnectionPage<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  pagination: CursorPaginationParams & {
    encodeRowCursor: (row: Record<string, unknown>) => string;
  },
): ConnectionPage<Row> {
  const needsCopy = pagination.inverted || rows.length > pagination.expectedSize;
  const trimmed: Row[] = needsCopy ? rows.slice(0, pagination.expectedSize) : (rows as Row[]);
  const ordered = pagination.inverted ? trimmed.reverse() : trimmed;
  const { encodeRowCursor } = pagination;

  const edges = ordered.map((node) => {
    let cached: string | undefined;
    const edge = { node } as { node: Row; cursor: string };
    Object.defineProperty(edge, 'cursor', {
      enumerable: false,
      configurable: true,
      get() {
        if (cached === undefined) {
          cached = encodeRowCursor(node);
        }
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
  };
}
