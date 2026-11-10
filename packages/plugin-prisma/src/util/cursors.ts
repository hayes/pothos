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
import { getModel } from './datamodel.js';
import type { DMMFField } from './get-client.js';
import { extendWithUsage } from './usage.js';

export function formatPrismaCursor(record: Record<string, unknown>, fields: string[] | string) {
  return cursorFormatter(fields)(record);
}

// `GPC:` is this plugin's namespace and stays; what follows it is `@pothos/core`'s tagged chunk
// encoding, shared with the drizzle plugin so the two can't drift apart again.
export function cursorFormatter(fields: string[] | string) {
  return (value: Record<string, unknown>) => {
    if (typeof fields === 'string') {
      return encodeBase64(`GPC:${encodeCursorChunk(value[fields])}`);
    }

    // A compound cursor tags each part. It used to be a bare `JSON.stringify` of the raw
    // values, which read a Date back as a string and threw outright on a bigint, so a
    // `@@unique` containing a bigint column failed on every edge.
    return encodeBase64(`GPC:${encodeCursorTuple(fields.map((name) => value[name]))}`);
  };
}

export function parsePrismaCursor(cursor: unknown) {
  if (typeof cursor !== 'string') {
    throw new PothosValidationError('Invalid cursor.');
  }

  try {
    const decoded = decodeBase64(cursor);

    if (decoded.startsWith('GPC:')) {
      return decodeCursorChunk(decoded.slice(4));
    }
  } catch {}

  throw new PothosValidationError('Invalid cursor.');
}

// What `String` writes for an integer and for a finite number.
const INTEGER = /^-?(0|[1-9]\d*)$/;
const NUMBER = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
// `Date#toISOString`, with or without the fraction, and the `String(date)` form ids were written
// in before it. The zone name in parentheses depends on the server's locale.
const ISO_DATE = /^([+-]\d{6}|\d{4})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const STRING_DATE =
  /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} -?\d{4,6} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}( \(.*\))?$/;
const MIN_BIGINT = BigInt('-9223372036854775808');
const MAX_BIGINT = BigInt('9223372036854775807');

function validDate(date: Date) {
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toBigInt(value: bigint) {
  return value >= MIN_BIGINT && value <= MAX_BIGINT ? value : undefined;
}

/**
 * Checks a decoded cursor value against its column's type, returning what prisma is given, or
 * `undefined` when the value is not one the plugin writes for that type. A DateTime may be the ISO
 * string a `J:` compound cursor holds; an enum is a string. Any other type is unchecked.
 */
function cursorValueChecker(field: DMMFField | undefined): (value: unknown) => unknown {
  if (field?.kind === 'enum') {
    return (value) => (typeof value === 'string' ? value : undefined);
  }

  switch (field?.type) {
    case 'String':
      return (value) => (typeof value === 'string' ? value : undefined);
    case 'Int':
      return (value) => (Number.isSafeInteger(value) ? value : undefined);
    case 'BigInt':
      return (value) =>
        typeof value === 'bigint'
          ? toBigInt(value)
          : Number.isSafeInteger(value)
            ? value
            : undefined;
    case 'Float':
      return (value) => (Number.isFinite(value) ? value : undefined);
    case 'Decimal':
      return (value) =>
        Number.isFinite(value) || (typeof value === 'string' && NUMBER.test(value))
          ? value
          : undefined;
    case 'Boolean':
      return (value) => (typeof value === 'boolean' ? value : undefined);
    case 'DateTime':
      return (value) =>
        value instanceof Date
          ? validDate(value)
          : typeof value === 'string' && ISO_DATE.test(value)
            ? validDate(new Date(value))
            : undefined;
    case 'Bytes':
      return (value) => (value instanceof Uint8Array ? value : undefined);
    default:
      return (value) => value;
  }
}

/** Reads an id back to the value `serializeID` wrote it from, or `undefined` if it is not one. */
function parseIDValue(id: string, dataType: string): unknown {
  switch (dataType) {
    case 'String':
      return id;
    case 'Int':
      return INTEGER.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : undefined;
    case 'BigInt':
      return INTEGER.test(id) ? toBigInt(BigInt(id)) : undefined;
    case 'Boolean':
      return id === 'true' ? true : id === 'false' ? false : undefined;
    case 'Float':
      return NUMBER.test(id) && Number.isFinite(Number(id)) ? Number(id) : undefined;
    case 'Decimal':
      return NUMBER.test(id) ? id : undefined;
    case 'DateTime':
      return ISO_DATE.test(id) || STRING_DATE.test(id) ? validDate(new Date(id)) : undefined;
    case 'Json':
      try {
        return JSON.parse(id) as unknown;
      } catch {
        return undefined;
      }
    // `Bytes` is what the datamodel calls the type; `Byte` has never matched one.
    case 'Byte':
    case 'Bytes': {
      const bytes = Buffer.from(id, 'base64');

      return bytes.toString('base64') === id ? bytes : undefined;
    }
    default:
      return id;
  }
}

export function parseID(id: string, dataType: string): unknown {
  const value = parseIDValue(id, dataType);

  if (value === undefined) {
    throw new PothosValidationError('Invalid ID.');
  }

  return value;
}

export function getDefaultIDSerializer<Types extends SchemaTypes>(
  modelName: string,
  fieldName: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): (parent: Record<string, unknown>) => unknown {
  const model = getModel(modelName, builder);

  const field = model.fields.find((f) => f.name === fieldName);

  if (field) {
    return (parent) => serializeID(parent[fieldName], field.type);
  }

  // `f.type` names the scalar (`Json`, `Bytes`, ...); `f.kind` only says `scalar`, which no case
  // of `serializeID` matches, and the parser below reads each part back by `f.type`.
  if ((model.primaryKey?.name ?? model.primaryKey?.fields.join('_')) === fieldName) {
    const fields = model.primaryKey!.fields.map((n) => model.fields.find((f) => f.name === n)!);
    return (parent) => JSON.stringify(fields.map((f) => serializeID(parent[f.name], f.type)));
  }

  const index = model.uniqueIndexes.find((idx) => (idx.name ?? idx.fields.join('_')) === fieldName);

  if (index) {
    const fields = index.fields.map((n) => model.fields.find((f) => f.name === n)!);
    return (parent) => JSON.stringify(fields.map((f) => serializeID(parent[f.name], f.type)));
  }

  throw new PothosValidationError(`Unable to find ${fieldName} for model ${modelName}`);
}

export function getDefaultIDParser<Types extends SchemaTypes>(
  modelName: string,
  fieldName: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): (id: string) => unknown {
  if (!fieldName) {
    throw new PothosValidationError('Missing field name');
  }
  const model = getModel(modelName, builder);

  const field = model.fields.find((f) => f.name === fieldName);

  if (field) {
    return (id) => parseID(id, field.type);
  }

  const index = model.uniqueIndexes.find((idx) => (idx.name ?? idx.fields.join('_')) === fieldName);

  let fields: DMMFField[] | undefined;
  if ((model.primaryKey?.name ?? model.primaryKey?.fields.join('_')) === fieldName) {
    fields = model.primaryKey!.fields.map((n) => model.fields.find((f) => f.name === n)!);
  } else if (index) {
    fields = index.fields.map((n) => model.fields.find((f) => f.name === n)!);
  }

  if (!fields) {
    throw new PothosValidationError(`Unable to find ${fieldName} for model ${modelName}`);
  }

  return (id) => {
    let parts: unknown;

    try {
      parts = JSON.parse(id);
    } catch {}

    if (
      !Array.isArray(parts) ||
      parts.length !== fields!.length ||
      !parts.every((part) => typeof part === 'string')
    ) {
      throw new PothosValidationError('Invalid ID.');
    }

    const result: Record<string, unknown> = {};

    for (let i = 0; i < fields!.length; i += 1) {
      result[fields![i].name] = parseID(parts[i], fields![i].type);
    }

    return result;
  };
}

export function serializeID(id: unknown, dataType: string) {
  switch (dataType) {
    case 'Json':
      return JSON.stringify(id);
    // `Bytes` is what the datamodel calls the type; `Byte` has never matched one.
    case 'Byte':
    case 'Bytes':
      if (id instanceof Uint8Array) {
        return Buffer.from(id).toString('base64');
      }
      return (id as Buffer | Uint8Array).toString('base64');
    // `String(date)` drops the milliseconds, and the id has to find the row again. Old ids in
    // that format still parse, since `new Date` reads both.
    case 'DateTime':
      return id instanceof Date ? id.toISOString() : String(id);
    default:
      return String(id);
  }
}

export function parseCompositeCursor(fields: readonly string[]) {
  return (cursor: unknown) => {
    // A `T:` cursor hands back the values with their types intact. A cursor issued before this
    // release is a `J:` chunk, whose array holds whatever plain JSON preserved -- see the
    // deprecated `J:` case in `@pothos/core`'s `decodeCursorChunk`.
    const parsed = parsePrismaCursor(cursor);

    // A cursor of the wrong width would otherwise leave a key `undefined` (or silently drop an
    // extra), and prisma rejects the query that builds. The drizzle plugin checks the same.
    if (!Array.isArray(parsed) || parsed.length !== fields.length) {
      throw new PothosValidationError('Invalid cursor.');
    }

    const record: Record<string, unknown> = {};

    fields.forEach((field, i) => {
      record[field] = parsed[i];
    });

    return record;
  };
}

export interface PrismaCursorConnectionQueryOptions {
  args: PothosSchemaTypes.DefaultConnectionArguments;
  ctx: {};
  defaultSize?: number | ((args: {}, ctx: {}) => number);
  maxSize?: number | ((args: {}, ctx: {}) => number);
  parseCursor: (cursor: string) => Record<string, unknown>;
}

interface ResolvePrismaCursorConnectionOptions extends PrismaCursorConnectionQueryOptions {
  parent?: unknown;
  query: {};
  totalCount?: number | (() => MaybePromise<number>);
}

// Compared against null rather than truthiness: `last: 0` is a backward page of zero rows.
function isBackward({ before, first, last }: PothosSchemaTypes.DefaultConnectionArguments) {
  return first == null && (before != null || last != null);
}

export function prismaCursorConnectionQuery({
  args,
  ctx,
  maxSize,
  defaultSize,
  parseCursor,
}: PrismaCursorConnectionQueryOptions) {
  const { before, after, first, last } = args;
  validateConnectionArguments(args);

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

  const { limit } = getConnectionPageSize({
    args,
    defaultSize: defaultSizeForConnection,
    maxSize: maxSizeForConnection,
  });

  // `last: 0` asks for the last zero rows, so it pages backwards like any other `last`. With
  // `first` as well, `first` wins and the page runs forward, as in `@pothos/core`.
  const take = isBackward(args) ? -limit : limit;

  return cursor == null
    ? { take, skip: 0 }
    : {
        cursor: parseCursor(cursor),
        take,
        skip: 1,
      };
}

export function wrapConnectionResult<T extends {}>(
  parent: unknown,
  results: readonly T[],
  args: PothosSchemaTypes.DefaultConnectionArguments,
  take: number,
  cursor: (node: T) => string,
  totalCount?: number | (() => MaybePromise<number>) | null,
  resolveNode?: (node: unknown) => unknown,
) {
  const gotFullResults = results.length === Math.abs(take);
  const backward = isBackward(args);
  const hasNextPage = backward ? args.before != null : gotFullResults;
  const hasPreviousPage = backward ? gotFullResults : args.after != null;
  const nodes = gotFullResults
    ? results.slice(take < 0 ? 1 : 0, take < 0 ? results.length : -1)
    : results;

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

  connection.edges = edges;
  connection.pageInfo.startCursor = edges[0]?.cursor ?? null;
  connection.pageInfo.endCursor = edges[edges.length - 1]?.cursor ?? null;

  return connection;
}

export async function resolvePrismaCursorConnection<T extends {}>(
  options: ResolvePrismaCursorConnectionOptions,
  cursor: (node: T) => string,
  resolve: (query: {
    include?: object;
    cursor?: object;
    take: number;
    skip: number;
  }) => MaybePromise<readonly T[]>,
) {
  const query = prismaCursorConnectionQuery(options);
  const results = await resolve(extendWithUsage(options.query, query));

  if (!results) {
    return results;
  }

  return wrapConnectionResult(
    options.parent,
    results,
    options.args,
    query.take,
    cursor,
    options.totalCount,
  );
}

export function getCursorFormatter<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  cursor: string,
) {
  const modelData = getModel(name, builder);
  const primaryKey = modelData.primaryKey?.name ?? modelData.primaryKey?.fields.join('_');
  if (primaryKey === cursor) {
    return cursorFormatter(modelData.primaryKey!.fields);
  }

  const uniqueIndex = modelData.uniqueIndexes.find(
    (idx) => (idx.name ?? idx.fields.join('_')) === cursor,
  );

  return cursorFormatter(uniqueIndex?.fields ?? cursor);
}

type OrderByEntry = Record<string, unknown>;

// The direction an ordering value sorts in: a direction, a `{ sort, nulls }`, or a relation or
// aggregate ordering whose last value holds one.
function orderDirection(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if ('sort' in value) {
    return value.sort;
  }

  const values = Object.values(value);

  return orderDirection(values[values.length - 1]);
}

/**
 * Makes a connection's `orderBy` unique, so a backward page (which prisma reads by reversing the
 * order) holds the same rows as the forward list. An order that does not name a non-null unique
 * key gets the cursor's fields appended in the direction of its last column; any other order is
 * returned as it is.
 */
export function getConnectionOrderBy<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  cursor: string,
) {
  const modelData = getModel(name, builder);
  const fields = new Map(modelData.fields.map((field) => [field.name, field]));
  const primaryKey = modelData.primaryKey?.name ?? modelData.primaryKey?.fields.join('_');
  const cursorFields =
    primaryKey === cursor
      ? modelData.primaryKey!.fields
      : (modelData.uniqueIndexes.find((idx) => (idx.name ?? idx.fields.join('_')) === cursor)
          ?.fields ?? [cursor]);

  const uniqueKeys = [
    ...(modelData.primaryKey ? [modelData.primaryKey.fields] : []),
    ...modelData.uniqueIndexes.map((idx) => idx.fields),
    ...modelData.fields
      .filter((field) => field.isId || field.isUnique)
      .map((field) => [field.name]),
  ].filter((key) => key.every((field) => fields.get(field)?.isRequired));

  const columns = new Set(
    modelData.fields
      .filter((field) => field.kind === 'scalar' || field.kind === 'enum')
      .map((field) => field.name),
  );

  return <T>(orderBy: T): T | OrderByEntry[] => {
    const entries = (
      Array.isArray(orderBy) ? orderBy : orderBy == null ? [] : [orderBy]
    ) as OrderByEntry[];
    // A key set to `undefined` is left out by prisma, so it orders nothing here either.
    const orderings = entries.flatMap((entry) =>
      Object.entries(entry).filter(([, value]) => value !== undefined),
    );

    if (orderings.length === 0) {
      return orderBy;
    }

    const named = new Set(orderings.map(([field]) => field).filter((field) => columns.has(field)));

    if (uniqueKeys.some((key) => key.every((field) => named.has(field)))) {
      return orderBy;
    }

    const missing = cursorFields.filter((field) => !named.has(field));

    if (missing.length === 0) {
      return orderBy;
    }

    const direction = orderDirection(orderings[orderings.length - 1][1]) ?? 'asc';

    return [...entries, ...missing.map((field) => ({ [field]: direction }))];
  };
}

export function getCursorParser<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  cursor: string,
) {
  const modelData = getModel(name, builder);
  const primaryKey = modelData.primaryKey?.name ?? modelData.primaryKey?.fields.join('_');
  const uniqueIndex = modelData.uniqueIndexes.find(
    (idx) => (idx.name ?? idx.fields.join('_')) === cursor,
  );
  const compoundFields = primaryKey === cursor ? modelData.primaryKey!.fields : uniqueIndex?.fields;
  const checkerFor = (fieldName: string) =>
    cursorValueChecker(modelData.fields.find((field) => field.name === fieldName));
  const check = (checker: (value: unknown) => unknown, value: unknown) => {
    const checked = checker(value);

    if (checked === undefined) {
      throw new PothosValidationError('Invalid cursor.');
    }

    return checked;
  };

  if (compoundFields) {
    const parse = parseCompositeCursor(compoundFields);
    const checkers = compoundFields.map(checkerFor);

    return (rawCursor: string) => {
      const record = parse(rawCursor);

      compoundFields.forEach((field, i) => {
        record[field] = check(checkers[i], record[field]);
      });

      return { [cursor]: record };
    };
  }

  const checker = checkerFor(cursor);

  return (rawCursor: string) => ({
    [cursor]: check(checker, parsePrismaCursor(rawCursor)),
  });
}
