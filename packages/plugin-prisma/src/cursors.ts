/* eslint-disable no-nested-ternary */
import { MaybePromise } from '@giraphql/core';

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_SIZE = 20;

function formatCursor(value: unknown): string {
  if (value instanceof Date) {
    return Buffer.from(`GPC:D:${String(Number(value))}`).toString('base64');
  }

  switch (typeof value) {
    case 'number':
      return Buffer.from(`GPC:N:${value}`).toString('base64');
    case 'string':
      return Buffer.from(`GPC:S:${value}`).toString('base64');
    default:
      throw new TypeError(`Unsupported cursor type ${typeof value}`);
  }
}

function parseCursor(cursor: unknown) {
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
      default:
        throw new TypeError(`Invalid cursor type ${type}`);
    }
  } catch {
    throw new Error(`Invalid cursor: ${cursor}`);
  }
}

interface PrismaCursorConnectionQueryOptions {
  args: GiraphQLSchemaTypes.DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
  column: string;
}

interface ResolvePrismaCursorConnectionOptions extends PrismaCursorConnectionQueryOptions {
  query: {};
  totalCount?: number;
}

export function prismaCursorConnectionQuery({
  args: { before, after, first, last },
  maxSize = DEFAULT_MAX_SIZE,
  defaultSize = DEFAULT_SIZE,
  column,
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
        cursor: {
          [column]: parseCursor(cursor),
        },
        take,
        skip: 1,
      };
}

export function wrapConnectionResult<T extends {}>(
  results: T[],
  args: GiraphQLSchemaTypes.DefaultConnectionArguments,
  take: number,
  column: string,
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
          cursor: formatCursor((value as Record<string, string>)[column]),
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
  resolve: (query: { include?: {}; cursor?: {}; take: number; skip: number }) => MaybePromise<T[]>,
) {
  const query = prismaCursorConnectionQuery(options);
  const results = await resolve({
    ...options.query,
    ...query,
  });

  return wrapConnectionResult(
    results,
    options.args,
    query.take,
    options.column,
    options.totalCount,
  );
}
