import {
  createContextCache,
  ObjectRef,
  PothosSchemaError,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import { selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextConfig } from './config.js';
import type { RequestOrderBy } from './cursors.js';

type SizeOption = number | ((args: never, ctx: never) => number);

export const isPageSize = (size: unknown): size is number =>
  Number.isSafeInteger(size) && (size as number) > 0;

/** Where a connection's nodes sit in its selection. */
export const CONNECTION_NODE_PATHS: string[][] = [['edges', 'node'], ['nodes']];

/** Any selection besides `totalCount` (including extension fields) loads rows. */
export function selectsRows(names: Iterable<string>): boolean {
  return [...names].some((name) => name !== 'totalCount' && name !== '__typename');
}

export function connectionNeedsRows(context: object, info: GraphQLResolveInfo): boolean {
  return selectsRows(selectedFieldNames(context, info));
}

/**
 * What every connection takes the same way: page sizes, falling back to the plugin's, and
 * `totalCount`, either `true` (the plugin counts the filtered collection) or a callback.
 */
export function connectionSettings<Count extends (...args: never[]) => unknown>(
  config: PrismaNextConfig,
  {
    defaultSize,
    maxSize,
    totalCount,
  }: { defaultSize?: SizeOption; maxSize?: SizeOption; totalCount?: boolean | Count },
) {
  // The plugin's own sizes are validated once, by getPluginConfig.
  for (const [name, size] of [
    ['defaultSize', defaultSize],
    ['maxSize', maxSize],
  ] as const) {
    if (typeof size === 'number' && !isPageSize(size)) {
      throw new PothosSchemaError(`Connection ${name} must be a positive integer, got ${size}.`);
    }
  }
  const resolve = (
    name: string,
    option: SizeOption | undefined,
    args: object,
    ctx: object,
  ): number | undefined => {
    if (typeof option !== 'function') {
      return option;
    }
    const size = option(args as never, ctx as never);
    if (!isPageSize(size)) {
      throw new PothosValidationError(
        `Connection ${name} callback must return a positive integer, got ${size}.`,
      );
    }
    return size;
  };
  return {
    sizes(args: object, ctx: object): { defaultSize?: number; maxSize?: number } {
      return {
        defaultSize: resolve('defaultSize', defaultSize, args, ctx) ?? config.defaultConnectionSize,
        maxSize: resolve('maxSize', maxSize, args, ctx) ?? config.maxConnectionSize,
      };
    },
    /**
     * Where the count `info` selects comes from: `'aggregate'` when the plugin counts the
     * collection, the callback otherwise. Without `info`, any configured count is selected.
     */
    countSource(
      ctx: object,
      info: GraphQLResolveInfo | undefined,
    ): 'aggregate' | Count | undefined {
      if (!totalCount || (info && !selectedFieldNames(ctx, info).has('totalCount'))) {
        return undefined;
      }
      return totalCount === true ? 'aggregate' : totalCount;
    },
    connectionOptions<T extends object>(connectionOptions: T): T {
      return totalCount ? (withTotalCount(connectionOptions) as T) : connectionOptions;
    },
  };
}

// A pre-registered connection ref can't be spread; it must declare totalCount itself.
function withTotalCount(connectionOptions: object): object {
  if (connectionOptions instanceof ObjectRef) {
    return connectionOptions;
  }
  const userFields = (connectionOptions as { fields?: (t: unknown) => Record<string, unknown> })
    .fields;
  return {
    ...connectionOptions,
    fields: (
      t: PothosSchemaTypes.ObjectFieldBuilder<SchemaTypes, { totalCount?: number }>,
    ): Record<string, unknown> => ({
      totalCount: t.int({
        nullable: false,
        resolve: (parent) => parent.totalCount ?? 0,
      }),
      ...(userFields ? userFields(t) : {}),
    }),
  };
}

type OrderSelector = (model: never, tools: unknown) => unknown;

/** A connection's `query` for one request: a literal, or a callback of the args and context. */
export function connectionQuery(
  query: unknown,
  args: object,
  ctx: object,
): { where?: unknown; orderBy?: RequestOrderBy } {
  const { where, orderBy } = ((typeof query === 'function' ? query(args, ctx) : query) ?? {}) as {
    where?: unknown;
    orderBy?: OrderSelector | readonly OrderSelector[];
  };
  if (orderBy === undefined) {
    return { where };
  }
  return {
    where,
    orderBy: (model, tools) =>
      (Array.isArray(orderBy)
        ? orderBy.map((selector: OrderSelector) => selector(model as never, tools))
        : (orderBy as OrderSelector)(model as never, tools)) as ReturnType<RequestOrderBy>,
  };
}

function missingCountAggregate() {
  return new PothosValidationError(
    "totalCount requires the ORM's count aggregate, which this contract's database target does not provide.",
  );
}

/** The count reducer of a relation's collection, for a `combine()` slot. */
export function relatedCount(collection: unknown): unknown {
  const { count } = collection as { count?: unknown };
  if (typeof count !== 'function') {
    throw missingCountAggregate();
  }
  return count.call(collection);
}

/** A synchronous throw becomes a rejection. */
export function aggregateCount(collection: unknown): Promise<number> {
  return Promise.resolve().then(() =>
    (
      collection as {
        aggregate: (
          fn: (a: { count?: () => unknown }) => Record<string, unknown>,
        ) => Promise<Record<string, number>>;
      }
    )
      .aggregate((a) => {
        if (typeof a.count !== 'function') {
          throw missingCountAggregate();
        }
        return { total: a.count() };
      })
      .then((r) => r.total),
  );
}

/**
 * A key that equal argument values share, or `undefined` for a value it can't tell apart from
 * others (a Set, Map, or class instance), which must not share a cached result.
 */
function argsKey(value: unknown): string | undefined {
  switch (typeof value) {
    case 'undefined':
      return 'u';
    case 'boolean':
    case 'number':
      return String(value);
    case 'bigint':
      return `${value}n`;
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (value === null) {
        return 'null';
      }
      if (value instanceof Date) {
        return `D${value.getTime()}`;
      }
      const parts: string[] = [];
      if (Array.isArray(value)) {
        for (const item of value) {
          const key = argsKey(item);
          if (key === undefined) {
            return undefined;
          }
          parts.push(key);
        }
        return `[${parts.join(',')}]`;
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        return undefined;
      }
      for (const [name, item] of Object.entries(value)) {
        const key = argsKey(item);
        if (key === undefined) {
          return undefined;
        }
        parts.push(`${JSON.stringify(name)}:${key}`);
      }
      return `{${parts.join(',')}}`;
    }
    default:
      return undefined;
  }
}

/**
 * A value per request and set of connection arguments. Keyed on the args object and on their
 * value, as planning and resolving may see different objects for the same arguments.
 */
export function createArgsCache<T>() {
  const cache = createContextCache(() => ({
    byArgs: new WeakMap<object, T>(),
    byValue: new Map<string, T>(),
  }));
  return {
    get(args: object, ctx: object): T | undefined {
      const { byArgs, byValue } = cache(ctx);
      if (byArgs.has(args)) {
        return byArgs.get(args);
      }
      const key = argsKey(args);
      const value = key === undefined ? undefined : byValue.get(key);
      if (value !== undefined) {
        byArgs.set(args, value);
      }
      return value;
    },
    set(args: object, ctx: object, value: T): T {
      const { byArgs, byValue } = cache(ctx);
      byArgs.set(args, value);
      const key = argsKey(args);
      if (key !== undefined) {
        byValue.set(key, value);
      }
      return value;
    },
  };
}
