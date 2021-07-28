/* eslint-disable @typescript-eslint/no-use-before-define */
import { SchemaTypes } from '@giraphql/core';
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

  // Get one extra to check for next page
  endOffset += 1;
  const totalSize = endOffset - startOffset;

  const lowerBound = after == null ? 0 : afterOffset;

  const hasPreviousPage = last == null ? startOffset > 0 : startOffset > lowerBound;

  return {
    offset: startOffset,
    limit: endOffset - startOffset,
    hasPreviousPage,
    expectedSize: totalSize - 1,
    hasNextPage: (resultSize: number) => {
      const upperBound = before == null ? startOffset + resultSize : beforeOffset;

      return last == null ? resultSize >= totalSize : upperBound > endOffset;
    },
  };
}

export async function resolveOffsetConnection<T>(
  options: ResolveOffsetConnectionOptions,
  resolve: (params: { offset: number; limit: number }) => Promise<T[]> | T[],
): Promise<ConnectionShape<SchemaTypes, T, boolean>> {
  const { limit, offset, expectedSize, hasPreviousPage, hasNextPage } = offsetForArgs(options);

  const nodes = await resolve({ offset, limit });

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
    edges: trimmed,
    pageInfo: {
      startCursor: trimmed[0]?.cursor ?? null,
      endCursor: trimmed[trimmed.length - 1]?.cursor ?? null,
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

  return Number.parseInt(string.slice(OFFSET_CURSOR_PREFIX.length), 10);
}

export function offsetToCursor(offset: number): string {
  return Buffer.from(`${OFFSET_CURSOR_PREFIX}${offset}`).toString('base64');
}

export function resolveArrayConnection<T>(
  options: ResolveArrayConnectionOptions,
  array: T[],
): ConnectionShape<SchemaTypes, T, boolean> {
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
    edges: trimmed,
    pageInfo: {
      startCursor: trimmed[0]?.cursor ?? null,
      endCursor: trimmed[trimmed.length - 1]?.cursor ?? null,
      hasPreviousPage,
      hasNextPage: hasNextPage(nodes.length),
    },
  };
}
