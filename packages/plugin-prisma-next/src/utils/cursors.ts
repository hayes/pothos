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
import { resolveStorageTable } from '@prisma/orm-family-sql/contract/resolve-storage-table';
import { and, or } from '@prisma/orm-family-sql/orm-client';
import { OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import type { AnyContract } from '../types.js';
import type { MapperCollection } from './adapter.js';
import { getCollectionPaginationState } from './collection-state.js';
import { resolveContractModel } from './contract.js';

// Per-column accessor shape. orm-client's `ModelAccessor` exposes the
// same methods; the local interface avoids the literal-contract generics
// the real type requires.
interface ComparableColumn {
  eq(v: unknown): unknown;
  gt(v: unknown): unknown;
  lt(v: unknown): unknown;
  isNull(): import('@prisma/orm-family-sql/relational-core/ast').AnyExpression;
  isNotNull(): unknown;
  asc(): unknown;
  desc(): unknown;
}

/** Use a codec for ORM scalar objects such as Temporal or Decimal values. */
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
      codec?: CursorValueCodec;
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
  const storage = model?.storage as
    | {
        table?: string;
        namespaceId?: string;
        fields?: Record<string, { column?: string }>;
      }
    | undefined;
  const table = storage?.table
    ? resolveStorageTable(contract.storage, storage.table, storage.namespaceId)?.table
    : undefined;
  if (!model || !table) {
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
  const columns = new Set(
    fields
      .filter((field) => !model.fields[field]!.nullable)
      .map((field) => storage?.fields?.[field]?.column ?? field),
  );
  const keys = [
    ...(table.primaryKey ? [table.primaryKey.columns] : []),
    ...(table.uniques ?? []).map((key) => key.columns),
    ...(table.indexes ?? []).flatMap((index) =>
      index.unique && !index.where && index.columns ? [index.columns] : [],
    ),
  ];
  if (!keys.some((key) => key.every((column) => columns.has(column)))) {
    throw new PothosSchemaError(
      `Connection cursor for '${modelName}' must include every field of a non-null primary or unique key. Add a unique tie-breaker such as id.`,
    );
  }
  return cursorFields(cursor).map((field) => {
    const name = typeof field === 'string' ? field : field.field;
    return model.fields[name]!.nullable
      ? {
          ...(typeof field === 'string' ? { field } : field),
          nulls: typeof field === 'string' ? 'last' : (field.nulls ?? 'last'),
        }
      : field;
  });
}

/**
 * `PNC:` namespaces this plugin's cursors the way `GPC:` and `DC:` namespace the prisma and
 * drizzle plugins'. What follows it is `@pothos/core`'s tagged chunk encoding, which all three
 * plugins share: a cursor over one column is that column's chunk (`I:42`, `D:1700000000123`),
 * and one over several is a `T:` tuple of chunks, positional, in the order `cols` gives.
 *
 * Every chunk carries its own type tag, so nothing is inferred from the payload's shape: a
 * bigint needs no envelope and a string column holding ISO-8601 shaped text stays a string.
 */
const CURSOR_PREFIX = 'PNC:';

export function encodeCursor(cursor: CursorInput, row: Record<string, unknown>): string {
  const values = cursorFields(cursor).map((field) => {
    const value = row[typeof field === 'string' ? field : field.field];
    return value !== null && typeof field !== 'string' && field.codec
      ? field.codec.encode(value as never)
      : value;
  });
  const payload = values.length === 1 ? encodeCursorChunk(values[0]) : encodeCursorTuple(values);

  return encodeBase64(`${CURSOR_PREFIX}${payload}`);
}

/**
 * Cap on user-supplied cursor + composite-ID payloads to deny
 * `JSON.parse(huge)` DoS. 2 KiB covers realistic compound cursors
 * with significant headroom.
 *
 * @internal
 */
export const CURSOR_PAYLOAD_MAX_BYTES = 2 * 1024;

/**
 * The cursor's values, keyed by `cols`.
 *
 * The keys come from `cols`, never from the cursor, so a `__proto__` or `constructor` key cannot
 * reach the output or the predicate builder below: the payload is positional and carries no keys
 * of its own. The result still has a null prototype as a second line of defence.
 *
 * A cursor of the wrong width is rejected rather than left to compare a column against
 * `undefined` (or to hand the ORM a `cursor()` boundary it cannot use). A cursor minted for a
 * different ordering of the same width reads as a position in this one, which is what the prisma
 * and drizzle plugins do with theirs.
 */
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
    // Don't interpolate the cursor into the message — log-aggregation
    // systems often capture error.message verbatim.
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

  // Dispatched on `cols`, not on what came back: a single column holding a JSON value decodes to
  // an array too, and that is one value rather than a tuple.
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
      if (values[i] !== null && typeof field !== 'string' && field.codec) {
        if (typeof values[i] !== 'string') {
          throw new Error('Codec cursor must contain a string');
        }
        out[col] = field.codec.decode(values[i]);
      } else {
        out[col] = values[i];
      }
    } catch {
      throw new PothosValidationError(`Invalid cursor value for ${col}.`);
    }
  });

  return out;
}

// Lexicographic "row > cursor" (or < for `lt`) as an OR-chain of
// equality-prefixed comparisons. Single-column case collapses to one
// comparison.
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
      // Null placement is independent of the value's asc/desc direction. A null
      // boundary either admits all non-null values or none at this tuple position.
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

/** Connection bases may be ordered, but cannot carry a limit, offset, or cursor. */
export function assertUnpaginatedCollection(collection: unknown): void {
  if (getCollectionPaginationState(collection).paginated) {
    throw new PothosValidationError(
      'Connection resolvers must return an unpaginated Collection without cursor(), limit(), or offset().',
    );
  }
}

function applyToCollection<C extends MapperCollection>(
  baseCollection: C,
  params: CursorPaginationParams,
): C {
  const { cols, cursor, directions, before, after, limit, inverted } = params;

  const nulls = cursorFields(cursor).map((field) =>
    typeof field === 'string' ? undefined : field.nulls,
  );
  const orderSelectors = cols.flatMap((col, i) => {
    const valueOrder = (c: Record<string, ComparableColumn>) =>
      inverted !== (directions[i] === 'desc') ? c[col]!.desc() : c[col]!.asc();
    return nulls[i]
      ? [
          (c: Record<string, ComparableColumn>) =>
            inverted !== (nulls[i] === 'first')
              ? OrderByItem.desc(c[col]!.isNull())
              : OrderByItem.asc(c[col]!.isNull()),
          valueOrder,
        ]
      : [valueOrder];
  });
  // RC9 appends orderBy entries and exposes no public reset. Compare the existing
  // prefix to the order produced by public accessors; append only missing entries.
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
    // Native keyset path. orderBy MUST precede cursor() (the orm's
    // `hasOrderBy` type gate). The decoded boundary is the same column→
    // value map the hand-rolled predicate consumes; native builds the
    // strict seek predicate internally.
    const boundary = decodeCursor(cursor, nativeAfter ? after! : before!);
    return withOrder.cursor(boundary).limit(limit) as C;
  }

  // Hand-rolled lexicographic predicate path: dual bounds, or a single
  // bound whose direction doesn't match the active order.
  let collection: MapperCollection = withOrder;
  if (after) {
    collection = collection.where(
      buildLexicographicPredicate(cols, decodeCursor(cursor, after), 'gt', directions, nulls),
    );
  }
  if (before) {
    collection = collection.where(
      buildLexicographicPredicate(cols, decodeCursor(cursor, before), 'lt', directions, nulls),
    );
  }
  return collection.limit(limit) as C;
}

export function applyCursorPagination<C extends MapperCollection>(
  baseCollection: C,
  cursor: CursorInput,
  args: import('@pothos/plugin-relay').DefaultConnectionArguments,
  options?: { defaultSize?: number; maxSize?: number },
): CursorPaginationResult<C> {
  assertUnpaginatedCollection(baseCollection);
  const params = buildPaginationParams(cursor, args, options);
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

/**
 * Each edge's `cursor` is a memoizing, non-enumerable getter — clients
 * selecting only `nodes` skip the JSON+base64 per row. The non-
 * enumerable flag also keeps JSON.stringify(page) from forcing every
 * encoder; pageInfo.startCursor/endCursor still hit the first/last.
 */
export function buildConnectionPage<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  pagination: CursorPaginationParams & {
    encodeRowCursor: (row: Record<string, unknown>) => string;
  },
): ConnectionPage<Row> {
  // Skip the slice in the common forward + full-page case — neither
  // over-fetch trimming nor shielding from the in-place reverse() is
  // needed. The orm-client's array passes through.
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
