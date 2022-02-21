/* eslint-disable no-nested-ternary */
import { MaybePromise } from '@pothos/core';

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_SIZE = 20;

export function formatCursorChunk(value: unknown) {
  if (value instanceof Date) {
    return `D:${String(Number(value))}`;
  }

  switch (typeof value) {
    case 'number':
      return `N:${value}`;
    case 'string':
      return `S:${value}`;
    default:
      throw new TypeError(`Unsupported cursor type ${typeof value}`);
  }
}

export function formatCursor(fields: string | string[]) {
  return (value: Record<string, unknown>) => {
    if (typeof fields === 'string') {
      return Buffer.from(`GPC:${formatCursorChunk(value[fields])}`).toString('base64');
    }

    return Buffer.from(`GPC:J:${JSON.stringify(fields.map((name) => value[name]))}`).toString(
      'base64',
    );
  };
}

export function parseRawCursor(cursor: unknown) {
  if (typeof cursor !== 'string') {
    throw new TypeError('Cursor must be a string');
  }

  try {
    const decoded = Buffer.from(cursor, 'base64').toString();
    const [, type, value] = decoded.match(/^GPC:(\w):(.*)/) as [string, string, string];

    switch (type) {
      case 'S':
        return value;
      case 'N':
        return Number.parseInt(value, 10);
      case 'D':
        return new Date(Number.parseInt(value, 10));
      case 'J':
        return JSON.parse(value) as unknown;
      default:
        throw new TypeError(`Invalid cursor type ${type}`);
    }
  } catch {
    throw new Error(`Invalid cursor: ${cursor}`);
  }
}

export function parseCompositeCursor(fields: string[]) {
  return (cursor: string) => {
    const parsed = parseRawCursor(cursor) as unknown[];

    if (!Array.isArray(parsed)) {
      throw new TypeError(`Expected compound cursor to contain an array, but got ${parsed}`);
    }

    const record: Record<string, unknown> = {};

    fields.forEach((field, i) => {
      record[field] = parsed[i];
    });

    return record;
  };
}

interface PrismaCursorConnectionQueryOptions {
  args: PothosSchemaTypes.DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
  parseCursor: (cursor: string) => Record<string, unknown>;
}

interface ResolvePrismaCursorConnectionOptions extends PrismaCursorConnectionQueryOptions {
  query: {};
  totalCount?: number;
}

export function prismaCursorConnectionQuery({
  args: { before, after, first, last },
  maxSize = DEFAULT_MAX_SIZE,
  defaultSize = DEFAULT_SIZE,
  parseCursor,
}: PrismaCursorConnectionQueryOptions) {
  if (first != null && first < 0) {
    throw new TypeError('Argument "first" must be a non-negative integer');
  }

  if (last != null && last < 0) {
    throw new Error('Argument "last" must be a non-negative integer');
  }

  if (before && after) {
    throw new Error('Arguments "before" and "after" are not supported at the same time');
  }

  if (before != null && last == null) {
    throw new Error('Argument "last" must be provided when using "before"');
  }

  if (before != null && first != null) {
    throw new Error('Arguments "before" and "first" are not supported at the same time');
  }

  if (after != null && last != null) {
    throw new Error('Arguments "after" and "last" are not supported at the same time');
  }

  const cursor = before ?? after;

  let take = Math.min(first ?? last ?? defaultSize, maxSize) + 1;

  if (before) {
    take = -take;
  }

  return cursor == null
    ? { take, skip: 0 }
    : {
        cursor: parseCursor(cursor),
        take,
        skip: 1,
      };
}

export function wrapConnectionResult<T extends {}>(
  results: T[],
  args: PothosSchemaTypes.DefaultConnectionArguments,
  take: number,
  cursor: (node: T) => string,
  totalCount?: number,
) {
  const gotFullResults = results.length === Math.abs(take);
  const hasNextPage = args.before ? true : gotFullResults;
  const hasPreviousPage = args.after ? true : args.before ? gotFullResults : false;
  const nodes = gotFullResults
    ? results.slice(take < 0 ? 1 : 0, take < 0 ? results.length : -1)
    : results;

  const edges = nodes.map((value, index) =>
    value == null
      ? null
      : {
          cursor: cursor(value),
          node: value,
        },
  );

  return {
    totalCount,
    edges,
    pageInfo: {
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor,
      hasPreviousPage,
      hasNextPage,
    },
  };
}

export async function resolvePrismaCursorConnection<T extends {}>(
  options: ResolvePrismaCursorConnectionOptions,
  cursor: (node: T) => string,
  resolve: (query: { include?: {}; cursor?: {}; take: number; skip: number }) => MaybePromise<T[]>,
) {
  const query = prismaCursorConnectionQuery(options);
  const results = await resolve({
    ...options.query,
    ...query,
  });

  return wrapConnectionResult(results, options.args, query.take, cursor, options.totalCount);
}
