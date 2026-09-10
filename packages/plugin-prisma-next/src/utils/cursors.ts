import {
  decodeBase64,
  decodeCursorChunk,
  encodeBase64,
  encodeCursorChunk,
  encodeCursorTuple,
  PothosValidationError,
} from '@pothos/core';
import { parseCursorConnectionArgs } from '@pothos/plugin-relay';
import { and, or } from '@prisma-next/sql-orm-client';
import type { MapperCollection } from './adapter.js';

// Per-column accessor shape. orm-client's `ModelAccessor` exposes the
// same methods; the local interface avoids the literal-contract generics
// the real type requires.
interface ComparableColumn {
  eq(v: unknown): unknown;
  gt(v: unknown): unknown;
  lt(v: unknown): unknown;
  asc(): unknown;
  desc(): unknown;
}

export function normalizeCursor(cursor: string | readonly string[]): readonly string[] {
  return typeof cursor === 'string' ? [cursor] : cursor;
}

/**
 * `PNC:` namespaces this plugin's cursors the way `GPC:` and `DC:` namespace the prisma and
 * drizzle plugins'. What follows it is `@pothos/core`'s tagged chunk encoding, which all three
 * plugins share: a cursor over one column is that column's chunk (`I:42`, `D:1700000000123`),
 * and one over several is a `T:` tuple of chunks, positional, in the order `cols` gives.
 *
 * Nothing is inferred from the payload's shape. The previous encoding was `JSON.stringify` of a
 * column-keyed object, which cannot hold a bigint (hence a `$bigint` envelope) and turns a Date
 * into a string that had to be guessed back with a regex over every string value -- so an
 * ordinary string column holding something ISO-8601 shaped came back as a Date.
 */
const CURSOR_PREFIX = 'PNC:';

export function encodeCursor(cols: readonly string[], row: Record<string, unknown>): string {
  const payload =
    cols.length === 1
      ? encodeCursorChunk(row[cols[0]!])
      : encodeCursorTuple(cols.map((col) => row[col]));

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
export function decodeCursor(cols: readonly string[], cursor: string): Record<string, unknown> {
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

  cols.forEach((col, i) => {
    out[col] = values[i];
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
): (c: Record<string, ComparableColumn>) => unknown {
  return (c) => {
    const clauses = cols.map((_, i) => {
      const equalities = cols.slice(0, i).map((col) => c[col]!.eq(values[col]));
      const col = c[cols[i]!]!;
      const v = values[cols[i]!];
      const compFinal = op === 'gt' ? col.gt(v) : col.lt(v);
      return equalities.length === 0
        ? compFinal
        : and(...(equalities as never[]), compFinal as never);
    });
    return clauses.length === 1 ? clauses[0] : or(...(clauses as never[]));
  };
}

export interface CursorPaginationParams {
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
  cursor: string | readonly string[],
  args: import('@pothos/plugin-relay').DefaultConnectionArguments,
  options?: { defaultSize?: number; maxSize?: number },
): CursorPaginationParams & { encodeRowCursor: (row: Record<string, unknown>) => string } {
  const cols = normalizeCursor(cursor);
  const { before, after, limit, expectedSize, inverted, hasPreviousPage, hasNextPage } =
    parseCursorConnectionArgs({
      args,
      ...(options?.defaultSize !== undefined ? { defaultSize: options.defaultSize } : {}),
      ...(options?.maxSize !== undefined ? { maxSize: options.maxSize } : {}),
    });
  return {
    cols,
    before,
    after,
    limit,
    expectedSize,
    inverted,
    hasPreviousPage,
    hasNextPage,
    encodeRowCursor: (row) => encodeCursor(cols, row),
  };
}

function applyToCollection<C extends MapperCollection>(
  baseCollection: C,
  params: CursorPaginationParams,
): C {
  const { cols, before, after, limit, inverted } = params;

  // orm-client's native `cursor()` seeks strictly past one boundary in
  // the *active orderBy direction*: `>` in asc, `<` in desc. The plugin
  // applies orderBy asc when forward and desc when `inverted`. So a
  // single bound maps to native `cursor()` only when its required
  // predicate direction matches the active order direction:
  //   - `after` → `gt`  → matches asc  → use native when NOT inverted
  //   - `before` → `lt` → matches desc → use native when inverted
  // The mismatched single-bound cases (`after`+inverted from
  // `last+after`, `before`+!inverted from `first+before`) and the
  // dual-bound case (`before` AND `after`) keep the hand-rolled
  // lexicographic predicate — native `cursor()` can't express them.
  const orderSelectors = cols.map(
    (col) => (c: Record<string, ComparableColumn>) => (inverted ? c[col]!.desc() : c[col]!.asc()),
  );
  const orderByArg = orderSelectors.length === 1 ? orderSelectors[0]! : orderSelectors;

  const dualBound = !!before && !!after;
  const nativeAfter = !!after && !before && !inverted;
  const nativeBefore = !!before && !after && inverted;

  if (!dualBound && (nativeAfter || nativeBefore)) {
    // Native keyset path. orderBy MUST precede cursor() (the orm's
    // `hasOrderBy` type gate). The decoded boundary is the same column→
    // value map the hand-rolled predicate consumes; native builds the
    // strict seek predicate internally.
    const boundary = decodeCursor(cols, nativeAfter ? after! : before!);
    return baseCollection.orderBy(orderByArg).cursor(boundary).take(limit) as C;
  }

  // Hand-rolled lexicographic predicate path: dual bounds, or a single
  // bound whose direction doesn't match the active order.
  let collection: MapperCollection = baseCollection;
  if (after) {
    collection = collection.where(
      buildLexicographicPredicate(cols, decodeCursor(cols, after), 'gt'),
    );
  }
  if (before) {
    collection = collection.where(
      buildLexicographicPredicate(cols, decodeCursor(cols, before), 'lt'),
    );
  }
  collection = collection.orderBy(orderByArg);
  return collection.take(limit) as C;
}

export function applyCursorPagination<C extends MapperCollection>(
  baseCollection: C,
  cursor: string | readonly string[],
  args: import('@pothos/plugin-relay').DefaultConnectionArguments,
  options?: { defaultSize?: number; maxSize?: number },
): CursorPaginationResult<C> {
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
