import { decodeBase64, encodeBase64, PothosValidationError } from '@pothos/core';
import { parseCursorConnectionArgs } from '@pothos/plugin-relay';
import { and, or } from '@prisma-next/sql-orm-client';
import type { MapperCollection } from './apply-selection';

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

// `$bigint` envelope so `JSON.stringify` doesn't throw on bigint cursor
// values. Dates serialize via toJSON (ISO string) and round-trip via
// `reviveValue` below.
export function encodeCursor(value: object): string {
  return encodeBase64(
    JSON.stringify(value, (_key, v) =>
      typeof v === 'bigint' ? { $bigint: v.toString() } : (v as unknown),
    ),
  );
}

// Heuristic re-hydration of ISO-8601 strings to Date — needed so SQL
// codecs that call `.toISOString()` on the input get a real Date.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reviveValue(value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATETIME_RE.test(value)) {
    return new Date(value);
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    // Object.hasOwn (not `in`) so a polluted Object.prototype.$bigint
    // can't redirect every object through the BigInt branch.
    Object.hasOwn(value, '$bigint') &&
    typeof (value as { $bigint: unknown }).$bigint === 'string'
  ) {
    // BigInt('garbage') throws SyntaxError — wrap as validation error
    // so a malicious cursor doesn't surface raw to the client.
    try {
      return BigInt((value as { $bigint: string }).$bigint);
    } catch {
      throw new PothosValidationError(
        'Invalid cursor: $bigint envelope contained a non-numeric string.',
      );
    }
  }
  return value;
}

/**
 * Cap on user-supplied cursor + composite-ID payloads to deny
 * `JSON.parse(huge)` DoS. 2 KiB covers realistic compound cursors
 * with significant headroom.
 *
 * @internal
 */
export const CURSOR_PAYLOAD_MAX_BYTES = 2 * 1024;

export function decodeCursor(cursor: string): Record<string, unknown> {
  if (cursor.length > CURSOR_PAYLOAD_MAX_BYTES) {
    throw new PothosValidationError(
      `Invalid cursor: payload exceeds ${CURSOR_PAYLOAD_MAX_BYTES} bytes.`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(decodeBase64(cursor));
  } catch (_err) {
    // Don't interpolate the cursor into the message — log-aggregation
    // systems often capture error.message verbatim.
    throw new PothosValidationError('Invalid cursor: not valid base64-encoded JSON.');
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PothosValidationError(
      `Invalid cursor: expected an object payload, got ${
        raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw
      }.`,
    );
  }
  // Object.create(null) + key filter so a `__proto__`/`constructor`
  // key in the parsed payload can't pollute the output or downstream
  // predicate builder.
  const out = Object.create(null) as Record<string, unknown>;
  for (const k of Object.keys(raw)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      continue;
    }
    out[k] = reviveValue((raw as Record<string, unknown>)[k]);
  }
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
    encodeRowCursor: (row) => {
      const value: Record<string, unknown> = {};
      for (const col of cols) {
        value[col] = row[col];
      }
      return encodeCursor(value);
    },
  };
}

export function applyToCollection<C extends MapperCollection>(
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
    const boundary = decodeCursor(nativeAfter ? after! : before!);
    return baseCollection.orderBy(orderByArg).cursor(boundary).take(limit) as C;
  }

  // Hand-rolled lexicographic predicate path: dual bounds, or a single
  // bound whose direction doesn't match the active order.
  let collection: MapperCollection = baseCollection;
  if (after) {
    collection = collection.where(buildLexicographicPredicate(cols, decodeCursor(after), 'gt'));
  }
  if (before) {
    collection = collection.where(buildLexicographicPredicate(cols, decodeCursor(before), 'lt'));
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
