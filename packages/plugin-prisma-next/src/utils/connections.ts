import {
  ObjectRef,
  PothosSchemaError,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import { selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextConfig } from './config.js';

type SizeOption = number | ((args: never, ctx: never) => number);

export const isPageSize = (size: unknown): size is number =>
  Number.isSafeInteger(size) && (size as number) > 0;

/** Any selection besides `totalCount` (including extension fields) loads rows. */
export function connectionNeedsRows(context: object, info: GraphQLResolveInfo): boolean {
  return [...selectedFieldNames(context, info)].some(
    (name) => name !== 'totalCount' && name !== '__typename',
  );
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
      const sizes = {
        defaultSize: resolve('defaultSize', defaultSize, args, ctx) ?? config.defaultConnectionSize,
        maxSize: resolve('maxSize', maxSize, args, ctx) ?? config.maxConnectionSize,
      };
      return {
        ...(sizes.defaultSize === undefined ? {} : { defaultSize: sizes.defaultSize }),
        ...(sizes.maxSize === undefined ? {} : { maxSize: sizes.maxSize }),
      };
    },
    countCallback: typeof totalCount === 'function' ? totalCount : undefined,
    /** Whether `info` selects a count the plugin computes. */
    countsRows: (ctx: object, info: GraphQLResolveInfo | undefined) =>
      totalCount === true && (!info || selectedFieldNames(ctx, info).has('totalCount')),
    /** Whether `info` selects a count from the callback. */
    callsCount: (ctx: object, info: GraphQLResolveInfo | undefined) =>
      typeof totalCount === 'function' &&
      (!info || selectedFieldNames(ctx, info).has('totalCount')),
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
export function argsKey(value: unknown): string | undefined {
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
