import {
  decodeBase64,
  decodeCursorChunk,
  encodeBase64,
  encodeCursorChunk,
  encodeCursorTuple,
  type MaybePromise,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import { getModel } from './datamodel.js';
import type { DMMFField } from './get-client.js';
import { extendWithUsage } from './usage.js';

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_SIZE = 20;

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
    throw new PothosValidationError('Cursor must be a string');
  }

  try {
    const decoded = decodeBase64(cursor);

    if (!decoded.startsWith('GPC:')) {
      throw new PothosValidationError('Invalid cursor');
    }

    return decodeCursorChunk(decoded.slice(4));
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
    // `Bytes` is what the datamodel calls the type; `Byte` has never matched one.
    case 'Byte':
    case 'Bytes':
      return Buffer.from(id, 'base64');
    default:
      return id;
  }
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
    const parts = JSON.parse(id) as unknown;

    if (!Array.isArray(parts)) {
      throw new PothosValidationError(`Invalid id received for ${fieldName} of ${modelName}`);
    }

    const result: Record<string, unknown> = {};

    for (let i = 0; i < fields!.length; i += 1) {
      result[fields![i].name] = parseID(parts[i] as string, fields![i].type);
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
    const parsed = parsePrismaCursor(cursor) as unknown[];

    if (!Array.isArray(parsed)) {
      throw new PothosValidationError(
        `Expected compound cursor to contain an array, but got ${parsed}`,
      );
    }

    // A cursor of the wrong width would otherwise leave a key `undefined` (or silently drop an
    // extra), and prisma rejects the query that builds. The drizzle plugin checks the same.
    if (parsed.length !== fields.length) {
      throw new PothosValidationError(
        `Expected compound cursor to contain ${fields.length} elements, but got ${parsed.length}`,
      );
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

export function prismaCursorConnectionQuery({
  args,
  ctx,
  maxSize = DEFAULT_MAX_SIZE,
  defaultSize = DEFAULT_SIZE,
  parseCursor,
}: PrismaCursorConnectionQueryOptions) {
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

  let take = Math.min(first ?? last ?? defaultSizeForConnection, maxSizeForConnection) + 1;

  // `last: 0` asks for the last zero rows, so it pages backwards like any other `last`.
  if (before != null || last != null) {
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
  parent: unknown,
  results: readonly T[],
  args: PothosSchemaTypes.DefaultConnectionArguments,
  take: number,
  cursor: (node: T) => string,
  totalCount?: number | (() => MaybePromise<number>) | null,
  resolveNode?: (node: unknown) => unknown,
) {
  const gotFullResults = results.length === Math.abs(take);
  // Compared against null rather than truthiness: `last: 0` is a backward page of zero rows.
  const backward = args.before != null || args.last != null;
  const hasNextPage = args.before != null ? true : args.last != null ? false : gotFullResults;
  const hasPreviousPage = args.after != null ? true : backward ? gotFullResults : false;
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

export function getCursorParser<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  cursor: string,
) {
  const modelData = getModel(name, builder);
  const primaryKey = modelData.primaryKey?.name ?? modelData.primaryKey?.fields.join('_');

  let parser = parsePrismaCursor;

  if (primaryKey === cursor) {
    parser = parseCompositeCursor(modelData.primaryKey!.fields);
  } else {
    const uniqueIndex = modelData.uniqueIndexes.find(
      (idx) => (idx.name ?? idx.fields.join('_')) === cursor,
    );

    if (uniqueIndex) {
      parser = parseCompositeCursor(uniqueIndex.fields);
    }
  }

  return (rawCursor: string) => ({
    [cursor]: parser(rawCursor),
  });
}
