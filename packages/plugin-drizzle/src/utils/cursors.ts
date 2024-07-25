/* eslint-disable no-nested-ternary */
import {
  decodeBase64,
  encodeBase64,
  MaybePromise,
  PothosValidationError,
  SchemaTypes,
} from '@pothos/core';
import {
  Column,
  getOperators,
  getOrderByOperators,
  SQL,
  TableRelationalConfig,
  TablesRelationalConfig,
} from 'drizzle-orm';
import { ConnectionOrderBy, QueryForDrizzleConnection } from '../types';
import { SelectionMap } from './selections';
import { GraphQLResolveInfo } from 'graphql';
import { queryFromInfo } from './map-query';

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

export function getCursorFormatter(fields: Column[]) {
  if (fields.length === 0) {
    throw new PothosValidationError('Cursor must have at least one field');
  }

  return (value: Record<string, unknown>) => {
    if (fields.length > 1) {
      return encodeBase64(`DC:J:${JSON.stringify(fields.map((col) => value[col.name]))}`);
    }

    return encodeBase64(`DC:${formatCursorChunk(value[fields[0].name])}`);
  };
}

export function parseDrizzleCursor(cursor: unknown) {
  if (typeof cursor !== 'string') {
    throw new PothosValidationError('Cursor must be a string');
  }

  try {
    const decoded = decodeBase64(cursor);
    const [, type, value] = decoded.match(/^DC:(\w):(.*)/) as [string, string, string];

    switch (type) {
      case 'S':
        return value;
      case 'N':
        return Number.parseInt(value, 10);
      case 'D':
        return new Date(Number.parseInt(value, 10));
      case 'J':
        return JSON.parse(value) as unknown;
      case 'I':
        return BigInt(value);
      default:
        throw new PothosValidationError(`Invalid cursor type ${type}`);
    }
  } catch {
    throw new PothosValidationError(`Invalid cursor: ${cursor}`);
  }
}

export function parseID(id: string, dataType: string): unknown {
  if (!id) {
    return id;
  }

  switch (dataType) {
    case 'String':
      return id;
    case 'Int':
      return Number.parseInt(id, 10);
    case 'BigInt':
      return BigInt(id);
    case 'Boolean':
      return id !== 'false';
    case 'Float':
    case 'Decimal':
      return Number.parseFloat(id);
    case 'DateTime':
      return new Date(id);
    case 'Json':
      return JSON.parse(id) as unknown;
    case 'Byte':
      return Buffer.from(id, 'base64');
    default:
      return id;
  }
}

// export function getDefaultIDSerializer<Types extends SchemaTypes>(
//   modelName: string,
//   fieldName: string,
//   builder: PothosSchemaTypes.SchemaBuilder<Types>,
// ): (parent: Record<string, unknown>) => unknown {
//   const model = getModel(modelName, builder);

//   const field = model.fields.find((f) => f.name === fieldName);

//   if (field) {
//     return (parent) => serializeID(parent[fieldName], field.type);
//   }

//   if ((model.primaryKey?.name ?? model.primaryKey?.fields.join('_')) === fieldName) {
//     const fields = model.primaryKey!.fields.map((n) => model.fields.find((f) => f.name === n)!);
//     return (parent) => JSON.stringify(fields.map((f) => serializeID(parent[f.name], f.kind)));
//   }

//   const index = model.uniqueIndexes.find((idx) => (idx.name ?? idx.fields.join('_')) === fieldName);

//   if (index) {
//     const fields = index.fields.map((n) => model.fields.find((f) => f.name === n)!);
//     return (parent) => JSON.stringify(fields.map((f) => serializeID(parent[f.name], f.kind)));
//   }

//   throw new PothosValidationError(`Unable to find ${fieldName} for model ${modelName}`);
// }

// export function getDefaultIDParser<Types extends SchemaTypes>(
//   modelName: string,
//   fieldName: string,
//   builder: PothosSchemaTypes.SchemaBuilder<Types>,
// ): (id: string) => unknown {
//   if (!fieldName) {
//     throw new PothosValidationError('Missing field name');
//   }
//   const model = getModel(modelName, builder);

//   const field = model.fields.find((f) => f.name === fieldName);

//   if (field) {
//     return (id) => parseID(id, field.type);
//   }

//   const index = model.uniqueIndexes.find((idx) => (idx.name ?? idx.fields.join('_')) === fieldName);

//   let fields: DMMFField[] | undefined;
//   if ((model.primaryKey?.name ?? model.primaryKey?.fields.join('_')) === fieldName) {
//     fields = model.primaryKey!.fields.map((n) => model.fields.find((f) => f.name === n)!);
//   } else if (index) {
//     fields = index.fields.map((n) => model.fields.find((f) => f.name === n)!);
//   }

//   if (!fields) {
//     throw new PothosValidationError(`Unable to find ${fieldName} for model ${modelName}`);
//   }

//   return (id) => {
//     const parts = JSON.parse(id) as unknown;

//     if (!Array.isArray(parts)) {
//       throw new PothosValidationError(`Invalid id received for ${fieldName} of ${modelName}`);
//     }

//     const result: Record<string, unknown> = {};

//     for (let i = 0; i < fields!.length; i += 1) {
//       result[fields![i].name] = parseID(parts[i] as string, fields![i].type);
//     }

//     return result;
//   };
// }

// export function serializeID(id: unknown, dataType: string) {
//   switch (dataType) {
//     case 'Json':
//       return JSON.stringify(id);
//     case 'Byte':
//       return (id as Buffer).toString('base64');
//     default:
//       return String(id);
//   }
// }

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
    } else if (typeof field === 'object' && 'desc' in field) {
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

  parsedOrderBy.columns.forEach((column) => {
    columns[column.name] = true;
  });

  let whereClauses: (SQL | undefined)[] = where ? [where] : [];

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
  totalCount?: number | (() => MaybePromise<number>) | null,
  resolveNode?: (node: unknown) => unknown,
) {
  const gotFullResults = results.length === Math.abs(limit);
  const hasNextPage = args.before ? true : args.last ? false : gotFullResults;
  const hasPreviousPage = args.after ? true : args.before ?? args.last ? gotFullResults : false;
  const nodes = gotFullResults
    ? results.slice(limit < 0 ? 1 : 0, limit < 0 ? results.length : -1)
    : results;

  const connection = {
    args,
    totalCount,
    edges: [] as ({ cursor: string; node: unknown } | null)[],
    pageInfo: {
      startCursor: null as string | null,
      endCursor: null as string | null,
      hasPreviousPage,
      hasNextPage,
    },
  };

  const edges = nodes.map((value, index) =>
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
  schema: TablesRelationalConfig,
  options: Omit<DrizzleCursorConnectionQueryOptions, 'orderBy'>,
  resolve: (
    queryFn: (query: QueryForDrizzleConnection<SchemaTypes, TableRelationalConfig>) => SelectionMap,
  ) => MaybePromise<readonly T[]>,
) {
  let query;
  let formatter;
  const results = await resolve((q) => {
    const { cursorColumns, ...connectionQuery } = drizzleCursorConnectionQuery({
      ...options,
      orderBy: q.orderBy ? q.orderBy(table.columns) : table.primaryKey,
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
      schema,
      // withUsageCheck: !!this.builder.options.prisma?.onUnusedQuery,
    });

    return query;
  });

  if (!results) {
    return results;
  }

  return wrapConnectionResult(
    results,
    options.args,
    query!.limit,
    formatter!,
    // options.totalCount,
  );
}
