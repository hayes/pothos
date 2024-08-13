import {
  type MaybePromise,
  PothosValidationError,
  type SchemaTypes,
  decodeBase64,
  encodeBase64,
} from '@pothos/core';
import {
  type Column,
  type DBQueryConfig,
  type SQL,
  type TableRelationalConfig,
  getOperators,
  getOrderByOperators,
} from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import type { ConnectionOrderBy, QueryForDrizzleConnection } from '../types';
import type { PothosDrizzleSchemaConfig } from './config';
import { queryFromInfo } from './map-query';
import type { SelectionMap } from './selections';

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
    case 'bigint':
      return `I:${value}`;
    default:
      throw new PothosValidationError(`Unsupported cursor type ${typeof value}`);
  }
}

export function formatDrizzleCursor(record: Record<string, unknown>, fields: Column[]) {
  return getCursorFormatter(fields)(record);
}

export function formatIDChunk(value: unknown) {
  if (value instanceof Date) {
    return `${String(Number(value))}`;
  }

  switch (typeof value) {
    case 'number':
    case 'string':
    case 'bigint':
      return `${value}`;
    default:
      throw new PothosValidationError(`Unsupported ID type ${typeof value}`);
  }
}

export function getIDSerializer(fields: Column[]) {
  if (fields.length === 0) {
    throw new PothosValidationError('Column serializer must have at least one field');
  }

  return (value: Record<string, unknown>) => {
    if (fields.length > 1) {
      return `${JSON.stringify(fields.map((col) => value[col.name]))}`;
    }

    return `${formatIDChunk(value[fields[0].name])}`;
  };
}

export function getColumnSerializer(fields: Column[]) {
  if (fields.length === 0) {
    throw new PothosValidationError('Column serializer must have at least one field');
  }

  return (value: Record<string, unknown>) => {
    if (fields.length > 1) {
      return `J:${JSON.stringify(fields.map((col) => value[col.name]))}`;
    }

    return `${formatCursorChunk(value[fields[0].name])}`;
  };
}

export function getCursorFormatter(fields: Column[]) {
  if (fields.length === 0) {
    throw new PothosValidationError('Cursor must have at least one field');
  }

  const serializer = getColumnSerializer(fields);

  return (value: Record<string, unknown>) => {
    return encodeBase64(`DC:${serializer(value)}`);
  };
}

export function parseDrizzleCursor(cursor: unknown) {
  if (typeof cursor !== 'string') {
    throw new PothosValidationError('Cursor must be a string');
  }

  try {
    const decoded = decodeBase64(cursor);
    if (!decoded.startsWith('DC:')) {
      throw new PothosValidationError('Invalid cursor');
    }

    return parseSerializedDrizzleColumn(decoded.slice(3));
  } catch {
    throw new PothosValidationError(`Invalid cursor: ${cursor}`);
  }
}

export function parseSerializedDrizzleColumn(value: unknown) {
  if (typeof value !== 'string') {
    throw new PothosValidationError('value must be a string');
  }

  try {
    const [, type, rawValue] = value.match(/^(S|N|D|J|I):(.*)/) as [string, string, string];

    switch (type) {
      case 'S':
        return rawValue;
      case 'N':
        return Number.parseInt(rawValue, 10);
      case 'D':
        return new Date(Number.parseInt(rawValue, 10));
      case 'J':
        return JSON.parse(rawValue) as unknown;
      case 'I':
        return BigInt(rawValue);
      default:
        throw new PothosValidationError(`Invalid cursor type ${type}`);
    }
  } catch {
    throw new PothosValidationError(`Invalid serialized data: ${value}`);
  }
}

export function parseSerializedIDColumn(id: string, field: Column): unknown {
  if (!id) {
    return id;
  }

  try {
    switch (field.dataType) {
      case 'date':
        return new Date(id);
      case 'string':
        return id;
      case 'number':
        return Number.parseInt(id, 10);
      case 'bigint':
        return BigInt(id);
      default:
        throw new PothosValidationError(`Unsupported ID type ${field.dataType}`);
    }
  } catch (error: unknown) {
    if (error instanceof PothosValidationError) {
      throw error;
    }

    throw new PothosValidationError(`Invalid serialized ID: ${id}`);
  }
}

export function getIDParser(fields: readonly Column[]) {
  if (fields.length === 0) {
    throw new PothosValidationError('Column parser must have at least one field');
  }

  return (value: string) => {
    if (fields.length === 1) {
      return { [fields[0].name]: parseSerializedIDColumn(value, fields[0]) };
    }

    try {
      const parsed = JSON.parse(value) as unknown[];

      if (!Array.isArray(parsed)) {
        throw new PothosValidationError(
          `Expected compound ID to contain an array, but got ${value}`,
        );
      }

      if (parsed.length !== fields.length) {
        throw new PothosValidationError(
          `Expected compound ID to contain ${fields.length} elements, but got ${parsed.length}`,
        );
      }

      const record: Record<string, unknown> = {};

      fields.forEach((field, i) => {
        record[field.name] = parsed[i];
      });

      return record;
    } catch (error: unknown) {
      if (error instanceof PothosValidationError) {
        throw error;
      }

      throw new PothosValidationError(`Invalid serialized ID: ${value}`);
    }
  };
}

export function getColumnParser(fields: readonly Column[]) {
  if (fields.length === 0) {
    throw new PothosValidationError('Column parser must have at least one field');
  }

  return (value: unknown) => {
    const parsed = parseSerializedDrizzleColumn(value) as unknown[];

    if (fields.length === 1) {
      return { [fields[0].name]: parsed };
    }

    if (!Array.isArray(parsed)) {
      throw new PothosValidationError(
        `Expected compound cursor to contain an array, but got ${parsed}`,
      );
    }

    if (parsed.length !== fields.length) {
      throw new PothosValidationError(
        `Expected compound cursor to contain ${fields.length} elements, but got ${parsed.length}`,
      );
    }

    const record: Record<string, unknown> = {};

    fields.forEach((field, i) => {
      record[field.name] = parsed[i];
    });

    return record;
  };
}

export function getCursorParser(fields: readonly Column[]) {
  if (fields.length === 0) {
    throw new PothosValidationError('Cursor must have at least one field');
  }

  return (cursor: unknown) => {
    const parsed = parseDrizzleCursor(cursor) as unknown[];

    if (fields.length === 1) {
      return { [fields[0].name]: parsed };
    }

    if (!Array.isArray(parsed)) {
      throw new PothosValidationError(
        `Expected compound cursor to contain an array, but got ${parsed}`,
      );
    }

    const record: Record<string, unknown> = {};

    fields.forEach((field, i) => {
      record[field.name] = parsed[i];
    });

    return record;
  };
}

export interface DrizzleCursorConnectionQueryOptions {
  args: PothosSchemaTypes.DefaultConnectionArguments;
  ctx: {};
  defaultSize?: number | ((args: {}, ctx: {}) => number);
  maxSize?: number | ((args: {}, ctx: {}) => number);
  orderBy: ConnectionOrderBy;
  where?: SQL;
}

const orderByOps = getOrderByOperators();

function parseOrderBy(orderBy: ConnectionOrderBy, invert: boolean) {
  if (!Array.isArray(orderBy)) {
    return parseOrderBy([orderBy], invert);
  }

  const asc = invert ? 'desc' : 'asc';
  const desc = invert ? 'asc' : 'desc';

  const normalized: { direction: 'asc' | 'desc'; column: Column }[] = orderBy.map((field) => {
    if (typeof field === 'object' && 'asc' in field) {
      return {
        direction: asc,
        column: field.asc,
      };
    }
    if (typeof field === 'object' && 'desc' in field) {
      return {
        direction: desc,
        column: field.desc,
      };
    }

    return {
      direction: asc,
      column: field,
    };
  });

  return {
    normalized,
    columns: normalized.map((field) => field.column),
    sql: normalized.map((field) => orderByOps[field.direction](field.column)),
  };
}

const ops = getOperators();

export function drizzleCursorConnectionQuery({
  args,
  ctx,
  maxSize = DEFAULT_MAX_SIZE,
  defaultSize = DEFAULT_SIZE,
  orderBy,
  where,
}: DrizzleCursorConnectionQueryOptions) {
  const { before, after, first, last } = args;
  if (first != null && first < 0) {
    throw new PothosValidationError('Argument "first" must be a non-negative integer');
  }

  if (last != null && last < 0) {
    throw new PothosValidationError('Argument "last" must be a non-negative integer');
  }

  if (before && after) {
    throw new PothosValidationError(
      'Arguments "before" and "after" are not supported at the same time',
    );
  }

  if (before != null && first != null) {
    throw new PothosValidationError(
      'Arguments "before" and "first" are not supported at the same time',
    );
  }

  if (after != null && last != null) {
    throw new PothosValidationError(
      'Arguments "after" and "last" are not supported at the same time',
    );
  }

  const cursor = before ?? after;

  const maxSizeForConnection = typeof maxSize === 'function' ? maxSize(args, ctx) : maxSize;
  const defaultSizeForConnection =
    typeof defaultSize === 'function' ? defaultSize(args, ctx) : defaultSize;

  let limit = Math.min(first ?? last ?? defaultSizeForConnection, maxSizeForConnection) + 1;

  if (before ?? last) {
    limit = -limit;
  }

  const parsedOrderBy = parseOrderBy(orderBy, limit < 0);

  const columns: Record<string, boolean> = {};

  for (const column of parsedOrderBy.columns) {
    columns[column.name] = true;
  }

  const whereClauses: (SQL | undefined)[] = where ? [where] : [];

  if (cursor) {
    const cursorParser = getCursorParser(parsedOrderBy.columns);
    const parsedCursor = cursorParser(cursor);

    whereClauses.push(
      ops.or(
        ...parsedOrderBy.normalized.map(({ direction, column }, index) => {
          const compare =
            direction === 'asc'
              ? ops.gt(column, parsedCursor[column.name])
              : ops.lt(column, parsedCursor[column.name]);

          if (index === 0) {
            return compare;
          }

          return ops.and(
            ...parsedOrderBy.normalized
              .slice(0, index)
              .map(({ column: c }) => ops.eq(c, parsedCursor[c.name])),
            compare,
          );
        }),
      ),
    );
  }

  return {
    cursorColumns: parsedOrderBy.columns,
    columns,
    orderBy: parsedOrderBy.sql,
    limit,
    offset: cursor ? 1 : 0,
    where: ops.and(...whereClauses),
  };
}

export function wrapConnectionResult<T extends {}>(
  results: readonly T[],
  args: PothosSchemaTypes.DefaultConnectionArguments,
  limit: number,
  cursor: (node: T) => string,
  resolveNode?: (node: Record<string, unknown>) => unknown,
) {
  const gotFullResults = results.length === Math.abs(limit);
  const hasNextPage = args.before ? true : args.last ? false : gotFullResults;
  const hasPreviousPage = args.after ? true : args.before ?? args.last ? gotFullResults : false;
  const nodes = gotFullResults
    ? results.slice(limit < 0 ? 1 : 0, limit < 0 ? results.length : -1)
    : results;

  const connection = {
    args,
    edges: [] as ({ cursor: string; node: unknown } | null)[],
    pageInfo: {
      startCursor: null as string | null,
      endCursor: null as string | null,
      hasPreviousPage,
      hasNextPage,
    },
  };

  const edges = nodes.map((value) =>
    value == null
      ? null
      : resolveNode
        ? {
            connection,
            ...value,
            cursor: cursor(value),
            node: resolveNode(value),
          }
        : {
            connection,
            cursor: cursor(value),
            node: value,
          },
  );

  if (args.last && !args.first) {
    edges.reverse();
  }

  connection.edges = edges;
  connection.pageInfo.startCursor = edges[0]?.cursor ?? null;
  connection.pageInfo.endCursor = edges[edges.length - 1]?.cursor ?? null;

  return connection;
}

export async function resolveDrizzleCursorConnection<T extends {}>(
  table: TableRelationalConfig,
  info: GraphQLResolveInfo,
  typeName: string,
  config: PothosDrizzleSchemaConfig,
  options: Omit<DrizzleCursorConnectionQueryOptions, 'orderBy'>,
  resolve: (
    queryFn: (query: QueryForDrizzleConnection<SchemaTypes, TableRelationalConfig>) => SelectionMap,
  ) => MaybePromise<readonly T[]>,
) {
  let query: DBQueryConfig<'many', false>;
  let formatter: (node: Record<string, unknown>) => string;
  const results = await resolve((q = {}) => {
    const { cursorColumns, ...connectionQuery } = drizzleCursorConnectionQuery({
      ...options,
      orderBy: q.orderBy
        ? typeof q.orderBy === 'function'
          ? q.orderBy(table.columns)
          : q.orderBy
        : table.primaryKey,
    });
    formatter = getCursorFormatter(cursorColumns);

    const where = typeof q.where === 'function' ? q.where(table.columns, getOperators()) : q.where;

    query = queryFromInfo({
      context: options.ctx,
      info,
      select: {
        ...connectionQuery,
        columns: {
          ...q.columns,
          ...connectionQuery.columns,
        },
        where: ops.and(connectionQuery.where, where),
      },
      paths: [['nodes'], ['edges', 'node']],
      typeName,
      config,
      // withUsageCheck: !!this.builder.options.prisma?.onUnusedQuery,
    });

    return query;
  });

  if (!results) {
    return results;
  }

  return wrapConnectionResult(results, options.args, query!.limit as number, formatter!);
}
