import { ObjectRef, PothosValidationError, type SchemaTypes } from '@pothos/core';
import { selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';

/** Any selection besides `totalCount` (including extension fields) loads rows. */
export function connectionNeedsRows(context: object, info: GraphQLResolveInfo): boolean {
  return [...selectedFieldNames(context, info)].some(
    (name) => name !== 'totalCount' && name !== '__typename',
  );
}

/** @internal */
export interface BuildTotalCountPromiseOptions {
  info: GraphQLResolveInfo;
  enabled: boolean;
  resolver:
    | ((parent: unknown, args: unknown, ctx: unknown, info: GraphQLResolveInfo) => unknown)
    | undefined;
  baseCollection: unknown;
  parent: unknown;
  args: unknown;
  context: unknown;
}

/** @internal A callback that throws synchronously becomes a rejection. */
export function buildTotalCountPromise(
  options: BuildTotalCountPromiseOptions,
): Promise<number | undefined> {
  const { info, enabled, resolver, baseCollection, parent, args, context } = options;
  if (!enabled || !selectedFieldNames(context as object, info).has('totalCount')) {
    return Promise.resolve(undefined);
  }
  if (resolver) {
    return Promise.resolve().then(
      () => resolver(parent, args, context, info) as number | Promise<number>,
    );
  }

  return aggregateCount(baseCollection);
}

/** @internal */
export function relatedCount(collection: unknown): unknown {
  const { count } = collection as { count?: unknown };
  if (typeof count !== 'function') {
    throw missingCountAggregate();
  }
  return count.call(collection);
}

function missingCountAggregate() {
  return new PothosValidationError(
    "totalCount requires the ORM's count aggregate, which this contract's database target does not provide.",
  );
}

/** @internal A synchronous throw becomes a rejection. */
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

// A pre-registered connection ref can't be spread; it must declare totalCount itself.
export function wrapConnectionOptionsWithTotalCount(connectionOptions: object): object {
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
