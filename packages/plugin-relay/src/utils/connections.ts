import { ConnectionShape, DefaultConnectionArguments } from '../types';

interface ResolveOffsetConnectionOptions {
  args: DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
}

interface ResolveArrayConnectionOptions {
  args: DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
}

const OFFSET_CURSOR_PREFIX = 'OffsetConnection:';

function offsetForArgs(options: ResolveOffsetConnectionOptions) {
  const { before, after, first, last } = options.args;

  const defaultSize = options.defaultSize ?? 20;
  const maxSize = options.maxSize ?? 100;
  const beforeOffset = before ? cursorToOffset(before) : Infinity;
  const afterOffset = after ? cursorToOffset(after) : 0;

  if (first != null && first < 0) {
    throw new TypeError('Argument "first" must be a non-negative integer');
  }

  if (last != null && last < 0) {
    throw new Error('Argument "last" must be a non-negative integer');
  }

  let startOffset = after ? afterOffset + 1 : 0;
  let endOffset = before ? Math.max(beforeOffset, startOffset) : Infinity;

  if (first != null) {
    endOffset = Math.min(endOffset, startOffset + first);
  }
  if (last != null) {
    if (endOffset === Infinity) {
      throw new Error('Argument "last" can only be used in combination with "before" or "first"');
    }
    startOffset = Math.max(startOffset, endOffset - last);
  }

  const size = first == null && last == null ? defaultSize : endOffset - startOffset;

  endOffset = Math.min(endOffset, startOffset + Math.min(size, maxSize));

  // Get one extra to check for next page
  endOffset = endOffset + 1;
  const totalSize = endOffset - startOffset;

  const lowerBound = after != null ? afterOffset : 0;

  const hasPreviousPage = last != null ? startOffset > lowerBound : startOffset > 0;

  return {
    offset: startOffset,
    limit: endOffset - startOffset,
    hasPreviousPage,
    expectedSize: totalSize - 1,
    hasNextPage: (resultSize: number) => {
      const upperBound = before != null ? beforeOffset : startOffset + resultSize;

      return last != null ? upperBound > endOffset : resultSize >= totalSize;
    },
  };
}

export async function resolveOffsetConnection<T>(
  options: ResolveOffsetConnectionOptions,
  resolve: (params: { offset: number; limit: number }) => T[] | Promise<T[]>,
): Promise<ConnectionShape<T, boolean>> {
  const { limit, offset, expectedSize, hasPreviousPage, hasNextPage } = offsetForArgs(options);

  const nodes = await resolve({ offset, limit });

  const edges = nodes.map((value, index) => ({
    cursor: offsetToCursor(offset + index),
    node: value,
  }));

  return {
    edges: edges.slice(0, expectedSize),
    pageInfo: {
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
      hasPreviousPage,
      hasNextPage: hasNextPage(nodes.length),
    },
  };
}

export function cursorToOffset(cursor: string): number {
  const string = Buffer.from(cursor, 'base64').toString();

  if (!string.startsWith(OFFSET_CURSOR_PREFIX)) {
    throw new Error(`Invalid offset cursor ${OFFSET_CURSOR_PREFIX}`);
  }
  return parseInt(string.substring(OFFSET_CURSOR_PREFIX.length), 10);
}

export function offsetToCursor(offset: number): string {
  return Buffer.from(`${OFFSET_CURSOR_PREFIX}${offset}`).toString('base64');
}

export function resolveArrayConnection<T>(
  options: ResolveArrayConnectionOptions,
  array: T[],
): ConnectionShape<T, boolean> {
  const { limit, offset, expectedSize, hasPreviousPage, hasNextPage } = offsetForArgs(options);

  const nodes = array.slice(offset, offset + limit);

  const edges = nodes.map((value, index) => ({
    cursor: offsetToCursor(offset + index),
    node: value,
  }));

  return {
    edges: edges.slice(0, expectedSize),
    pageInfo: {
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
      hasPreviousPage,
      hasNextPage: hasNextPage(nodes.length),
    },
  };
}
