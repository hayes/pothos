/* eslint-disable no-nested-ternary */
import { MaybePromise, SchemaTypes } from '@pothos/core';
// eslint-disable-next-line import/no-cycle
import { getModel } from './datamodel';
import { DMMFField } from './get-client';

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
      case 'I':
        // eslint-disable-next-line node/no-unsupported-features/es-builtins
        return BigInt(value);
      default:
        throw new TypeError(`Invalid cursor type ${type}`);
    }
  } catch {
    throw new Error(`Invalid cursor: ${cursor}`);
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
      // eslint-disable-next-line node/no-unsupported-features/es-builtins
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

  if ((model.primaryKey?.name ?? model.primaryKey?.fields.join('_')) === fieldName) {
    const fields = model.primaryKey!.fields.map((n) => model.fields.find((f) => f.name === n)!);
    return (parent) => JSON.stringify(fields.map((f) => serializeID(parent[f.name], f.kind)));
  }

  const index = model.uniqueIndexes.find((idx) => (idx.name ?? idx.fields.join('_')) === fieldName);

  if (index) {
    const fields = index.fields.map((n) => model.fields.find((f) => f.name === n)!);
    return (parent) => JSON.stringify(fields.map((f) => serializeID(parent[f.name], f.kind)));
  }

  throw new Error(`Unable to find ${fieldName} for model ${modelName}`);
}

export function getDefaultIDParser<Types extends SchemaTypes>(
  modelName: string,
  fieldName: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): (id: string) => unknown {
  if (!fieldName) {
    throw new Error('Missing field name');
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
    throw new Error(`Unable to find ${fieldName} for model ${modelName}`);
  }

  return (id) => {
    const parts = JSON.parse(id) as unknown;

    if (!Array.isArray(parts)) {
      throw new TypeError(`Invalid id received for ${fieldName} of ${modelName}`);
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
    case 'Byte':
      return (id as Buffer).toString('base64');
    default:
      return String(id);
  }
}

export function parseCompositeCursor(fields: string[]) {
  return (cursor: unknown) => {
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

export interface PrismaCursorConnectionQueryOptions {
  args: PothosSchemaTypes.DefaultConnectionArguments;
  defaultSize?: number;
  maxSize?: number;
  parseCursor: (cursor: string) => Record<string, unknown>;
}

interface ResolvePrismaCursorConnectionOptions extends PrismaCursorConnectionQueryOptions {
  query: {};
  totalCount?: number | (() => MaybePromise<number>);
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
  totalCount?: number | (() => MaybePromise<number>),
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

export function getCursorFormatter<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  cursor: string,
) {
  const modelData = getModel(name, builder);
  const primaryKey = modelData.primaryKey?.name ?? modelData.primaryKey?.fields.join('_');
  if (primaryKey === cursor) {
    return formatCursor(modelData.primaryKey!.fields);
  }

  const uniqueIndex = modelData.uniqueIndexes.find(
    (idx) => (idx.name ?? idx.fields.join('_')) === cursor,
  );

  return formatCursor(uniqueIndex?.fields ?? cursor);
}

export function getCursorParser<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  cursor: string,
) {
  const modelData = getModel(name, builder);
  const primaryKey = modelData.primaryKey?.name ?? modelData.primaryKey?.fields.join('_');

  let parser = parseRawCursor;

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
