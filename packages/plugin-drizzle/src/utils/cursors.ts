import {
  decodeBase64,
  decodeCursorChunk,
  encodeBase64,
  encodeCursorChunk,
  encodeCursorTuple,
  getConnectionPageSize,
  type MaybePromise,
  PothosValidationError,
  type SchemaTypes,
  validateConnectionArguments,
} from '@pothos/core';
import {
  asc,
  type Column,
  type DBQueryConfig,
  desc,
  eq,
  getColumns,
  gt,
  isNull,
  lt,
  type SQL,
  sql,
  type Table,
  type TableRelationalConfig,
} from 'drizzle-orm';
import type { ConnectionOrderBy, QueryForDrizzleConnection } from '../types.js';
import type { DrizzlePlan } from './adapter.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import { queryFromPlan } from './map-query.js';
import { omitUndefinedKeys, type SelectionMap } from './selections.js';

// The tagging is `@pothos/core`'s `encodeCursorChunk`, shared with the prisma plugins so the
// three can't drift apart again. A nullish ordering value is a position this plugin compares
// against with `is null`, and it now writes as a `Z:` chunk: it used to interpolate as the string
// `null`, which is not a chunk, so the cursor came back out as "Invalid cursor" on the next page.
export const formatCursorChunk = encodeCursorChunk;

export function formatDrizzleCursor(
  record: Record<string, unknown>,
  fields: Column[],
  config: PothosDrizzleSchemaConfig,
) {
  return getCursorFormatter(fields, config)(record);
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

// A compound ID is plain JSON, which refuses a bigint outright and turns a Date into a string, so
// those two are written as a decimal string and epoch milliseconds and read back off the column.
function formatCompoundIDValue(value: unknown) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return Number(value);
  }

  return value;
}

function parseCompoundIDValue(value: unknown, field: Column) {
  if (
    field.dataType.startsWith('bigint') &&
    (typeof value === 'string' || typeof value === 'number')
  ) {
    return BigInt(value);
  }

  // A Date column's value comes back from the epoch milliseconds `formatCompoundIDValue` wrote.
  if (field.dataType === 'object date' && typeof value === 'number') {
    return new Date(value);
  }

  return value;
}

export function getIDSerializer(fields: Column[], config: PothosDrizzleSchemaConfig) {
  if (fields.length === 0) {
    throw new PothosValidationError('Column serializer must have at least one field');
  }

  return (value: Record<string, unknown>) => {
    if (fields.length > 1) {
      return `${JSON.stringify(
        fields.map((col) => formatCompoundIDValue(value[config.columnToTsName(col)])),
      )}`;
    }

    return `${formatIDChunk(value[config.columnToTsName(fields[0])])}`;
  };
}

// A cursor is built from the ordering, and the ordering can name a column or an
// extra the query selected. Either way what the cursor needs is the key the
// value arrives under on the row.
export type CursorField = Column | string;

export function cursorFieldKey(field: CursorField, config: PothosDrizzleSchemaConfig) {
  return typeof field === 'string' ? field : config.columnToTsName(field);
}

export function getColumnSerializer(
  fields: readonly CursorField[],
  config: PothosDrizzleSchemaConfig,
) {
  if (fields.length === 0) {
    throw new PothosValidationError('Column serializer must have at least one field');
  }

  return (value: Record<string, unknown>) => {
    if (fields.length > 1) {
      // each value carries its own type tag, the same ones a single value gets.
      // Plain JSON would turn a Date into a string and refuse a bigint outright.
      return encodeCursorTuple(fields.map((field) => value[cursorFieldKey(field, config)]));
    }

    return formatCursorChunk(value[cursorFieldKey(fields[0], config)]);
  };
}

export function getCursorFormatter(
  fields: readonly CursorField[],
  config: PothosDrizzleSchemaConfig,
) {
  if (fields.length === 0) {
    throw new PothosValidationError('Cursor must have at least one field');
  }

  const serializer = getColumnSerializer(fields, config);

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

export function parseSerializedDrizzleColumn(value: unknown): unknown {
  if (typeof value !== 'string') {
    throw new PothosValidationError('value must be a string');
  }

  try {
    // `@pothos/core`'s `decodeCursorChunk` reads every tag, including the `J:` a compound cursor
    // used before each part carried one -- see `getCursorParser` for what happens to that array.
    return decodeCursorChunk(value);
  } catch {
    throw new PothosValidationError(`Invalid serialized data: ${value}`);
  }
}

export function parseSerializedIDColumn(id: string, field: Column): unknown {
  if (!id) {
    return id;
  }

  try {
    if (field.dataType.startsWith('number')) {
      // `Number`, not `parseInt`: a `doublePrecision` ID of `1.75` truncates to `1`, and a large
      // one written as `1e+21` reads as `1`, so the node looked up is a different row or none.
      return Number(id);
    }

    if (field.dataType.startsWith('bigint')) {
      return BigInt(id);
    }

    if (field.dataType.startsWith('string')) {
      return id;
    }

    if (field.dataType === 'object date') {
      // `formatIDChunk` writes the epoch milliseconds; `new Date` of that string is an Invalid
      // Date, since it is not a date format `Date` parses.
      return new Date(Number(id));
    }

    throw new PothosValidationError(`Unsupported ID type ${field.dataType}`);
  } catch (error: unknown) {
    if (error instanceof PothosValidationError) {
      throw error;
    }

    throw new PothosValidationError(`Invalid serialized ID: ${id}`);
  }
}

// Keyed by the typescript name, as `getIDSerializer` reads by: the record is a row of the table,
// and every consumer (the node ref's `parseId`, the model loader) looks columns up that way.
export function getIDParser(fields: readonly Column[], config: PothosDrizzleSchemaConfig) {
  if (fields.length === 0) {
    throw new PothosValidationError('Column parser must have at least one field');
  }

  return (value: string) => {
    if (fields.length === 1) {
      return { [config.columnToTsName(fields[0])]: parseSerializedIDColumn(value, fields[0]) };
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
        record[config.columnToTsName(field)] = parseCompoundIDValue(parsed[i], field);
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

export function getCursorParser(keys: readonly string[]) {
  if (keys.length === 0) {
    throw new PothosValidationError('Cursor must have at least one field');
  }

  return (cursor: unknown) => {
    const parsed = parseDrizzleCursor(cursor);

    if (keys.length === 1) {
      return { [keys[0]]: parsed };
    }

    // A cursor issued before a column joined the ordering only holds values for
    // the columns that came before it. Those still describe a position, just a
    // less precise one, so the page is keyed off the prefix the cursor covers
    // rather than rejected. Cursors returned by that page carry every column.
    //
    // The array is a `T:` chunk's values, each still its own type. A cursor issued before this
    // release decodes from a `J:` chunk instead, whose parts arrive as whatever plain JSON
    // preserved -- see the deprecated `J:` case in `@pothos/core`'s `decodeCursorChunk`.
    const values = Array.isArray(parsed) ? parsed : [parsed];

    if (values.length === 0) {
      throw new PothosValidationError('Cursor contains no values');
    }

    if (values.length > keys.length) {
      throw new PothosValidationError(
        `Expected cursor to contain at most ${keys.length} values, but got ${values.length}`,
      );
    }

    const record: Record<string, unknown> = {};

    values.forEach((value, i) => {
      record[keys[i]] = value;
    });

    return record;
  };
}

export interface DrizzleCursorConnectionQueryOptions {
  args: PothosSchemaTypes.DefaultConnectionArguments;
  ctx: {};
  defaultSize?: number | ((args: {}, ctx: {}) => number);
  maxSize?: number | ((args: {}, ctx: {}) => number);
  orderBy: ConnectionOrderBy<TableRelationalConfig>;
  extras?: Record<string, OrderByExpression | undefined>;
  where?: SQL;
  config: PothosDrizzleSchemaConfig;
  table: TableRelationalConfig;
}

export type OrderByExpression = SQL | ((table: never, operators: never) => SQL);

// An ordering entry is either a column or an expression the query selected as
// an extra. `key` is where the value lands on the row, and so what the cursor
// is built from; `target` is what SQL orders and compares.
type OrderByEntry = {
  direction: 'asc' | 'desc';
  key: string;
  column?: Column;
  expression?: OrderByExpression;
};

function resolveExpression(expression: OrderByExpression, table: Table) {
  return typeof expression === 'function'
    ? (expression as (table: Table, operators: { sql: typeof sql }) => SQL)(table, { sql })
    : expression;
}

// Drizzle aliases the table it is querying (`d0`), so ordering and comparing
// have to reach for the column on that alias rather than the original table.
// Expressions get the alias handed to them and resolve themselves.
function orderTarget(entry: OrderByEntry, table: Table) {
  if (entry.column) {
    return (table as unknown as Record<string, Column>)[entry.key] ?? entry.column;
  }

  return resolveExpression(entry.expression!, table);
}

function flipDirection(direction: 'asc' | 'desc') {
  return direction === 'asc' ? 'desc' : 'asc';
}

function ordersBy(entries: OrderByEntry[], column: Column) {
  return entries.some((entry) => entry.column?.name === column.name);
}

// The ordering fixes a row's position only if some set of columns the database
// keeps unique is fully covered by it. A nullable column can't contribute:
// rows sharing a null tie with each other, and a cursor compared against null
// matches nothing.
function orderIsUnique(
  entries: OrderByEntry[],
  config: PothosDrizzleSchemaConfig,
  table: TableRelationalConfig,
) {
  return config
    .getUniqueConstraints(table.name)
    .some((columns) => columns.every((column) => column.notNull && ordersBy(entries, column)));
}

// A cursor names a row's position in the ordering, which only works if no two
// rows can share a position. Ordering by a column with duplicate values (a
// timestamp, a status) leaves ties to be broken arbitrarily, so a row can move
// between pages and end up returned twice or skipped entirely. Appending a key
// the database keeps unique fixes that. Key columns already in the ordering are
// left where the user put them.
function appendTieBreaker(
  entries: OrderByEntry[],
  config: PothosDrizzleSchemaConfig,
  table: TableRelationalConfig,
) {
  if (orderIsUnique(entries, config, table)) {
    return;
  }

  const tieBreaker = config.findTieBreaker(table.name);

  if (!tieBreaker) {
    return;
  }

  const direction = entries[entries.length - 1]?.direction ?? 'asc';

  for (const column of tieBreaker) {
    if (!ordersBy(entries, column)) {
      entries.push({ direction, key: config.columnToTsName(column), column });
    }
  }
}

function parseOrderBy(
  config: PothosDrizzleSchemaConfig,
  table: TableRelationalConfig,
  orderBy: ConnectionOrderBy<TableRelationalConfig>,
  invert: boolean,
  extras?: Record<string, OrderByExpression | undefined>,
) {
  const normalized: OrderByEntry[] = [];

  const columnEntry = (column: Column, direction: 'asc' | 'desc') => ({
    direction,
    key: config.columnToTsName(column),
    column,
  });

  if ('table' in orderBy && orderBy.table && typeof orderBy.table === 'object') {
    normalized.push(columnEntry(orderBy as unknown as Column, 'asc'));
  } else if (Array.isArray(orderBy)) {
    for (const field of orderBy) {
      normalized.push(columnEntry(field, 'asc'));
    }
  } else {
    const tableColumns = getColumns(table.table as Table);
    Object.entries(
      orderBy as {
        [k: string]: 'asc' | 'desc' | undefined;
      },
    ).forEach(([name, direction]) => {
      if (!direction) {
        return;
      }

      const column = tableColumns[name];

      if (column) {
        normalized.push(columnEntry(column, direction));
        return;
      }

      const expression = extras?.[name];

      if (!expression) {
        throw new PothosValidationError(
          `Can't order by "${name}": ${table.name} has no such column, and the query passed to the connection declares no extra with that name`,
        );
      }

      normalized.push({ direction, key: name, expression });
    });
  }

  appendTieBreaker(normalized, config, table);

  const directionFor = ({ direction }: OrderByEntry) =>
    invert ? flipDirection(direction) : direction;

  return {
    normalized,
    // only real columns need adding to the selection; extras are already selected
    columns: normalized.flatMap(({ column }) => (column ? [column] : [])),
    cursorFields: normalized.map(({ column, key }) => column ?? key),
    // the object form can only name columns, so an expression forces the
    // callback form -- which renders identically for the columns beside it
    orderBy: normalized.some(({ expression }) => expression)
      ? (t: Table) =>
          normalized.map((entry) =>
            (directionFor(entry) === 'asc' ? asc : desc)(orderTarget(entry, t)),
          )
      : Object.fromEntries(normalized.map((entry) => [entry.key, directionFor(entry)])),
  };
}

// Rows past the cursor are those where the first ordering column that differs
// from the cursor differs in the direction being paged. Columns the cursor
// doesn't cover are left out: it was issued for a shorter ordering, and its
// prefix still describes a position.
function compareTo(entry: OrderByEntry, operator: 'gt' | 'lt' | 'eq', value: unknown) {
  const isNullish = value === null || value === undefined;

  if (entry.column) {
    if (operator === 'eq' && isNullish) {
      return { [entry.key]: { isNull: true } };
    }

    // never the `{ column: value }` shorthand: drizzle reads any object value
    // as a nested filter, so a null throws and a Date silently drops the
    // comparison. Naming the operator works for every value a cursor can hold
    return { [entry.key]: { [operator]: value } };
  }

  if (operator === 'eq' && isNullish) {
    return { RAW: (table: Table) => isNull(orderTarget(entry, table) as SQL) };
  }

  const operators = { gt, lt, eq };

  // RAW hands the filter the table it is being built against, which is what an
  // expression needs to resolve
  return {
    RAW: (table: Table) => operators[operator](orderTarget(entry, table) as SQL, value),
  };
}

function keysetFilter(entries: OrderByEntry[], cursor: string, paging: 'after' | 'before') {
  const parsedCursor = getCursorParser(entries.map(({ key }) => key))(cursor);
  const covered = entries.filter(({ key }) => key in parsedCursor);

  const parts = covered.map((entry, index) => {
    const ascending = paging === 'after' ? entry.direction === 'asc' : entry.direction === 'desc';
    const compare = compareTo(entry, ascending ? 'gt' : 'lt', parsedCursor[entry.key]);

    if (index === 0) {
      return compare;
    }

    return {
      AND: [
        ...covered
          .slice(0, index)
          .map((previous) => compareTo(previous, 'eq', parsedCursor[previous.key])),
        compare,
      ],
    };
  });

  return parts.length > 1 ? { OR: parts } : parts[0];
}

export function drizzleCursorConnectionQuery({
  args,
  ctx,
  maxSize,
  defaultSize,
  orderBy,
  extras,
  where,
  config,
  table,
}: DrizzleCursorConnectionQueryOptions) {
  const { before, after, first, last } = args;
  validateConnectionArguments(args);

  if (first != null && last != null) {
    throw new PothosValidationError(
      'Arguments "first" and "last" are not supported at the same time',
    );
  }

  const maxSizeForConnection = typeof maxSize === 'function' ? maxSize(args, ctx) : maxSize;
  const defaultSizeForConnection =
    typeof defaultSize === 'function' ? defaultSize(args, ctx) : defaultSize;

  const { limit } = getConnectionPageSize({
    args,
    defaultSize: defaultSizeForConnection,
    maxSize: maxSizeForConnection,
  });
  // `last: 0` asks for the last zero rows, so it pages backwards like any other `last`.
  const inverted = first == null && last != null;

  const parsedOrderBy = parseOrderBy(config, table, orderBy, inverted, extras);

  const columns: Record<string, boolean> = {};

  for (const column of parsedOrderBy.columns) {
    columns[config.columnToTsName(column)] = true;
  }

  const whereClauses: {}[] = [];

  if (where) {
    whereClauses.push(where);
  }

  if (after) {
    whereClauses.push(keysetFilter(parsedOrderBy.normalized, after, 'after'));
  }

  if (before) {
    whereClauses.push(keysetFilter(parsedOrderBy.normalized, before, 'before'));
  }

  return omitUndefinedKeys({
    cursorFields: parsedOrderBy.cursorFields,
    columns,
    orderBy: parsedOrderBy.orderBy,
    limit,
    where: whereClauses.length > 1 ? { AND: whereClauses } : whereClauses[0],
  });
}

export function wrapConnectionResult<T extends {}>(
  results: readonly T[],
  args: PothosSchemaTypes.DefaultConnectionArguments,
  limit: number,
  cursor: (node: T) => string,
  resolveNode?: (node: Record<string, unknown>) => unknown,
  parent?: unknown,
  totalCount?: number | (() => MaybePromise<number>) | null,
) {
  const gotFullResults = results.length === Math.abs(limit);
  // `first`/`last` are compared against null rather than by truthiness, so `last: 0` reports the
  // `pageInfo` of a backward page of zero rows rather than of a forward one.
  const backward = args.first == null && args.last != null;
  const hasNextPage = args.before ? true : args.last != null ? false : gotFullResults;
  const hasPreviousPage = args.after ? true : backward ? gotFullResults : false;
  const nodes = gotFullResults ? results.slice(0, -1) : results;

  const connection = {
    parent,
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

  if (backward) {
    edges.reverse();
  }

  connection.edges = edges;
  connection.pageInfo.startCursor = edges[0]?.cursor ?? null;
  connection.pageInfo.endCursor = edges[edges.length - 1]?.cursor ?? null;

  return connection;
}

export async function resolveDrizzleCursorConnection<T extends {}>(
  tableName: string,
  // The settled plan of the connection's rows; the builder handed to `resolve` merges into it.
  plan: DrizzlePlan | undefined,
  config: PothosDrizzleSchemaConfig,
  options: Omit<DrizzleCursorConnectionQueryOptions, 'orderBy' | 'config' | 'table'> & {
    totalCount?: () => MaybePromise<number>;
  },
  resolve: (
    queryFn: (query: QueryForDrizzleConnection<SchemaTypes, TableRelationalConfig>) => SelectionMap,
  ) => MaybePromise<readonly T[]>,
  parent: unknown,
) {
  const table = config.relations[tableName];
  let query: DBQueryConfig<'many'> | undefined;
  let formatter: (node: Record<string, unknown>) => string;
  const results = await resolve((q = {}) => {
    const { cursorFields, ...connectionQuery } = drizzleCursorConnectionQuery({
      ...options,
      config,
      orderBy:
        (typeof q.orderBy === 'function' ? q.orderBy(table.table as Table) : q.orderBy) ??
        config.getPrimaryKey(table.name),
      extras: q.extras as DrizzleCursorConnectionQueryOptions['extras'],
      table,
    });
    formatter = getCursorFormatter(cursorFields, config);

    query = queryFromPlan(
      plan,
      omitUndefinedKeys({
        ...connectionQuery,
        extras: q.extras,
        columns: {
          ...q.columns,
          ...connectionQuery.columns,
        },
        where:
          connectionQuery.where && q.where
            ? {
                AND: [q.where, connectionQuery.where],
              }
            : q.where || connectionQuery.where,
      }) as never,
    );

    return query;
  });

  if (!results) {
    return results;
  }

  // Handle totalCountOnly case where resolve returns [] without calling query function
  if (!query) {
    return {
      parent,
      args: options.args,
      totalCount: options.totalCount,
      edges: [],
      pageInfo: {
        startCursor: null,
        endCursor: null,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    };
  }

  const { limit } = query;

  return wrapConnectionResult(
    results,
    options.args,
    limit as number,
    formatter!,
    undefined,
    parent,
    options.totalCount,
  );
}
