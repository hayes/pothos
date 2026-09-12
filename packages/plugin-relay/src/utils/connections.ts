import {
  decodeBase64,
  encodeBase64,
  type MaybePromise,
  type Merge,
  PothosValidationError,
  parseCursorConnectionArgs,
  type SchemaTypes,
} from '@pothos/core';
import type { ArrayConnectionShape, DefaultConnectionArguments } from '../types.js';

interface ResolveOffsetConnectionOptions {
  args: DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
  totalCount?: number;
}

export interface ResolveCursorConnectionOptions<T> {
  args: DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
  toCursor: (value: T, nodes: T[]) => string;
}

export interface ResolveCursorConnectionArgs {
  before?: string;
  after?: string;
  limit: number;
  inverted: boolean;
}

interface ResolveArrayConnectionOptions {
  args: DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
}

/** `true` only for `any`, which otherwise matches both branches of a conditional type. */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * `null` when the resolver can return `null` (directly or from its promise), `never` otherwise.
 *
 * This is unioned in at the outermost level rather than passed to `ArrayConnectionShape`'s
 * `Nullable` parameter, because intersecting a possibly-null union with an object type drops the
 * null member. `resolveOffsetConnection` used to declare this derivation inline and it never
 * reached callers, because `& { totalCount: C }` was applied on top of it. `Merge` is not the
 * culprit and does preserve null; the hazard is the intersection, so keep this out of one.
 *
 * `any` is excluded deliberately. It satisfies both branches of every conditional below, and
 * `Promise<null> extends Promise<any>` is true, so an `any`-typed resolver would be reported as
 * nullable even though such code never sees a null and compiled before nullability was derived
 * at all.
 */
type ConnectionNullability<U> =
  IsAny<U> extends true
    ? never
    : IsAny<Awaited<U>> extends true
      ? never
      : U extends NonNullable<U>
        ? Promise<null> extends U
          ? null
          : never
        : null;

const OFFSET_CURSOR_PREFIX = 'OffsetConnection:';
const DEFAULT_MAX_SIZE = 100;
const DEFAULT_SIZE = 20;

export function offsetForArgs(options: ResolveOffsetConnectionOptions) {
  const { before, after, first, last } = options.args;

  const defaultSize = options.defaultSize ?? DEFAULT_SIZE;
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const beforeOffset = before ? cursorToOffset(before) : Number.POSITIVE_INFINITY;
  const afterOffset = after ? cursorToOffset(after) : 0;

  if (first != null && first < 0) {
    throw new PothosValidationError('Argument "first" must be a non-negative integer');
  }

  if (last != null && last < 0) {
    throw new PothosValidationError('Argument "last" must be a non-negative integer');
  }

  const endOfCollection =
    options.totalCount != null ? Math.max(options.totalCount, 0) : Number.POSITIVE_INFINITY;

  let startOffset = after ? afterOffset + 1 : 0;
  // A cursor that was valid before the collection shrank can now point past the end of it, in
  // either direction. Clamping to the known size keeps the window inside the collection: a stale
  // `before` cursor still pages off the real end, and a stale `after` cursor yields an empty
  // window rather than a negative one. `beforeOffset` is already `Infinity` when `before` is
  // absent, so the same expression covers both.
  let endOffset = Math.max(Math.min(beforeOffset, endOfCollection), startOffset);

  if (first != null) {
    endOffset = Math.min(endOffset, startOffset + first);
  }
  if (last != null) {
    if (endOffset === Number.POSITIVE_INFINITY) {
      throw new PothosValidationError(
        'Argument "last" can only be used in combination with "before" or "first"',
      );
    }
    // Cap the backward page size before deriving the start offset so that trimming for
    // `maxSize` keeps the last requested items rather than sliding the window backwards.
    startOffset = Math.max(startOffset, endOffset - Math.min(last, maxSize));
  }

  const size = first == null && last == null ? defaultSize : endOffset - startOffset;

  endOffset = Math.min(endOffset, startOffset + Math.min(size, maxSize));

  const totalSize = endOffset - startOffset;

  return {
    offset: startOffset,
    limit: totalSize + 1,
    hasPreviousPage: startOffset > 0,
    expectedSize: totalSize,
    hasNextPage: (resultSize: number) => resultSize > totalSize,
  };
}

export async function resolveOffsetConnection<
  T,
  U extends Promise<readonly T[] | null> | readonly T[] | null,
  C extends number | undefined = undefined,
>(
  options: ResolveOffsetConnectionOptions & { totalCount?: C },
  resolve: (params: {
    offset: number;
    limit: number;
  }) => U & (MaybePromise<readonly T[] | null> | null),
): Promise<
  | Merge<
      ArrayConnectionShape<
        SchemaTypes,
        NonNullable<T>,
        false,
        T extends NonNullable<T> ? false : { list: false; items: true },
        false
      > & { totalCount: C }
    >
  | ConnectionNullability<U>
> {
  const { limit, offset, expectedSize, hasPreviousPage, hasNextPage } = offsetForArgs(options);

  const nodes = (await resolve({ offset, limit })) as T[] | null;

  if (!nodes) {
    return nodes as never;
  }

  const edges = nodes.map((value, index) =>
    value == null
      ? null
      : {
          cursor: offsetToCursor(offset + index),
          node: value,
        },
  );

  const trimmed = edges.slice(0, expectedSize);

  return {
    edges: trimmed as never,
    totalCount: options.totalCount as never,
    pageInfo: {
      startCursor: offsetToCursor(offset),
      endCursor: offsetToCursor(offset + trimmed.length - 1),
      hasPreviousPage,
      hasNextPage: hasNextPage(nodes.length),
    },
  };
}

export function cursorToOffset(cursor: string): number {
  const string = decodeBase64(cursor);

  if (!string.startsWith(OFFSET_CURSOR_PREFIX)) {
    throw new PothosValidationError(`Invalid offset cursor ${OFFSET_CURSOR_PREFIX}`);
  }

  return Number.parseInt(string.slice(OFFSET_CURSOR_PREFIX.length), 10);
}

export function offsetToCursor(offset: number): string {
  return encodeBase64(`${OFFSET_CURSOR_PREFIX}${offset}`);
}

export function resolveArrayConnection<T>(
  options: ResolveArrayConnectionOptions,
  array: readonly T[],
): Merge<
  ArrayConnectionShape<
    SchemaTypes,
    NonNullable<T>,
    false,
    T extends NonNullable<T> ? false : { list: false; items: true },
    false
  > & { totalCount: number }
> {
  const { limit, offset, expectedSize, hasPreviousPage, hasNextPage } = offsetForArgs({
    totalCount: array.length,
    ...options,
  });

  const nodes = array.slice(offset, offset + limit);

  const edges = nodes.map((value, index) =>
    value == null
      ? null
      : {
          cursor: offsetToCursor(offset + index),
          node: value,
        },
  );

  const trimmed = edges.slice(0, expectedSize);

  return {
    edges: trimmed as never,
    totalCount: array.length,
    pageInfo: {
      startCursor: offsetToCursor(offset),
      endCursor: offsetToCursor(offset + trimmed.length - 1),
      hasPreviousPage,
      hasNextPage: hasNextPage(nodes.length),
    },
  };
}

export { parseCursorConnectionArgs } from '@pothos/core';

type NodeType<T> = T extends readonly (infer N)[] | Promise<readonly (infer N)[] | null>
  ? N
  : never;

export async function resolveCursorConnection<
  U extends Promise<readonly unknown[] | null> | readonly unknown[] | null,
>(
  options: ResolveCursorConnectionOptions<NodeType<U>>,
  resolve: (params: ResolveCursorConnectionArgs) => U,
): Promise<
  | Merge<ArrayConnectionShape<SchemaTypes, NodeType<U>, false, false, false>>
  | ConnectionNullability<U>
> {
  const { before, after, limit, inverted, expectedSize, hasPreviousPage, hasNextPage } =
    parseCursorConnectionArgs(options);

  const nodes = (await resolve({ before, after, limit, inverted })) as NodeType<U>[] | null;

  if (!nodes) {
    return nodes as never;
  }

  const trimmed = nodes.slice(0, expectedSize);

  if (inverted) {
    trimmed.reverse();
  }

  const edges = trimmed.map((value) =>
    value == null
      ? null
      : {
          cursor: options.toCursor(value, trimmed),
          node: value,
        },
  );

  const startCursor =
    edges.length > 0 ? edges[0]?.cursor : (options.args.after ?? options.args.before ?? '');
  const endCursor =
    edges.length > 0
      ? edges[edges.length - 1]?.cursor
      : (options.args.after ?? options.args.before ?? '');

  return {
    edges: edges as never,
    pageInfo: {
      startCursor,
      endCursor,
      hasPreviousPage: hasPreviousPage(nodes.length),
      hasNextPage: hasNextPage(nodes.length),
    },
  };
}
