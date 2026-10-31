import { ObjectRef, PothosValidationError, type SchemaTypes } from '@pothos/core';
import { selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextConfig } from './config.js';

type SizeOption = number | ((args: never, ctx: never) => number);

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
  const resolve = (option: SizeOption | undefined, args: object, ctx: object) =>
    typeof option === 'function' ? option(args as never, ctx as never) : option;
  return {
    sizes(args: object, ctx: object): { defaultSize?: number; maxSize?: number } {
      const sizes = {
        defaultSize: resolve(defaultSize, args, ctx) ?? config.defaultConnectionSize,
        maxSize: resolve(maxSize, args, ctx) ?? config.maxConnectionSize,
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
