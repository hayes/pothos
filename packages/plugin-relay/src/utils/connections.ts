import { decodeBase64, encodeBase64, MaybePromise, SchemaTypes } from '@pothos/core';
import { ConnectionShape, DefaultConnectionArguments } from '../types';

interface ResolveOffsetConnectionOptions {
  args: DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
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

const OFFSET_CURSOR_PREFIX = 'OffsetConnection:';
const DEFAULT_MAX_SIZE = 100;
const DEFAULT_SIZE = 20;

function offsetForArgs(options: ResolveOffsetConnectionOptions) {
  const { before, after, first, last } = options.args;

  const defaultSize = options.defaultSize ?? DEFAULT_SIZE;
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const beforeOffset = before ? cursorToOffset(before) : Number.POSITIVE_INFINITY;
  const afterOffset = after ? cursorToOffset(after) : 0;

  if (first != null && first < 0) {
    throw new TypeError('Argument "first" must be a non-negative integer');
  }

  if (last != null && last < 0) {
    throw new Error('Argument "last" must be a non-negative integer');
  }

  let startOffset = after ? afterOffset + 1 : 0;
  let endOffset = before ? Math.max(beforeOffset, startOffset) : Number.POSITIVE_INFINITY;

  if (first != null) {
    endOffset = Math.min(endOffset, startOffset + first);
  }
  if (last != null) {
    if (endOffset === Number.POSITIVE_INFINITY) {
      throw new Error('Argument "last" can only be used in combination with "before" or "first"');
    }
    startOffset = Math.max(startOffset, endOffset - last);
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

export async function resolveOffsetConnection<T, U extends Promise<T[] | null> | T[] | null>(
  options: ResolveOffsetConnectionOptions,
  resolve: (params: { offset: number; limit: number }) => U & (MaybePromise<T[] | null> | null),
): Promise<
  ConnectionShape<
    SchemaTypes,
    NonNullable<T>,
    U extends NonNullable<U> ? (Promise<null> extends U ? true : false) : true,
    T extends NonNullable<T> ? false : { list: false; items: true },
    false
  >
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
    throw new Error(`Invalid offset cursor ${OFFSET_CURSOR_PREFIX}`);
  }

  return Number.parseInt(string.slice(OFFSET_CURSOR_PREFIX.length), 10);
}

export function offsetToCursor(offset: number): string {
  return encodeBase64(`${OFFSET_CURSOR_PREFIX}${offset}`);
}

export function resolveArrayConnection<T>(
  options: ResolveArrayConnectionOptions,
  array: T[],
): ConnectionShape<
  SchemaTypes,
  NonNullable<T>,
  boolean,
  T extends NonNullable<T> ? false : { list: false; items: true },
  false
> {
  const { limit, offset, expectedSize, hasPreviousPage, hasNextPage } = offsetForArgs(options);

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
    pageInfo: {
      startCursor: offsetToCursor(offset),
      endCursor: offsetToCursor(offset + trimmed.length - 1),
      hasPreviousPage,
      hasNextPage: hasNextPage(nodes.length),
    },
  };
}

function parseCurserArgs(options: ResolveOffsetConnectionOptions) {
  const { before, after, first, last } = options.args;

  const defaultSize = options.defaultSize ?? DEFAULT_SIZE;
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;

  if (first != null && first < 0) {
    throw new TypeError('Argument "first" must be a non-negative integer');
  }

  if (last != null && last < 0) {
    throw new Error('Argument "last" must be a non-negative integer');
  }

  const limit = Math.min(first ?? last ?? defaultSize, maxSize) + 1;
  const inverted = after ? !!last && !first : (!!before && !first) || (!first && !!last);

  return {
    before: before ?? void 0,
    after: after ?? void 0,
    limit,
    expectedSize: limit - 1,
    inverted,
    hasPreviousPage: (resultSize: number) => !!after || (resultSize >= limit && !first),
    hasNextPage: (resultSize: number) => !!before || (!last && resultSize >= limit),
  };
}

type NodeType<T> = T extends Promise<(infer N)[] | null> | (infer N)[] | null ? N : never;

export async function resolveCursorConnection<
  U extends Promise<unknown[] | null> | unknown[] | null,
>(
  options: ResolveCursorConnectionOptions<NodeType<U>>,
  resolve: (params: ResolveCursorConnectionArgs) => U,
): Promise<ConnectionShape<SchemaTypes, NodeType<U>, false, false, false>> {
  const { before, after, limit, inverted, expectedSize, hasPreviousPage, hasNextPage } =
    parseCurserArgs(options);

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
    edges.length > 0 ? edges[0]?.cursor : options.args.after ?? options.args.before ?? '';
  const endCursor =
    edges.length > 0
      ? edges[edges.length - 1]?.cursor
      : options.args.after ?? options.args.before ?? '';

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
