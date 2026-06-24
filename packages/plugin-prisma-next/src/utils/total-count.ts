import { ObjectRef, type SchemaTypes } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import { selectionIncludesField } from './selection-walk';

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

/**
 * Gated on selection: if the client didn't select `totalCount`, return
 * resolved-undefined. The callback path uses deferred construction so
 * a synchronously-throwing callback yields a rejected promise instead
 * of bubbling out before `Promise.allSettled` is reached.
 *
 * @internal
 */
export function buildTotalCountPromise(
  options: BuildTotalCountPromiseOptions,
): Promise<number | undefined> {
  const { info, enabled, resolver, baseCollection, parent, args, context } = options;
  if (!enabled || !selectionIncludesField(info, 'totalCount')) {
    return Promise.resolve(undefined);
  }
  if (resolver) {
    return Promise.resolve().then(
      () => resolver(parent, args, context, info) as number | Promise<number>,
    );
  }
  return Promise.resolve().then(() =>
    (
      baseCollection as {
        aggregate: (
          fn: (a: { count: () => unknown }) => Record<string, unknown>,
        ) => Promise<Record<string, number>>;
      }
    )
      .aggregate((a) => ({ total: a.count() }))
      .then((r) => r.total),
  );
}

// Short-circuit on a pre-registered ObjectRef (shared connection type):
// spreading the ref would corrupt it. The totalCount field has to live
// on the original type definition.
export function wrapConnectionOptionsWithTotalCount(connectionOptions: object): object {
  if (connectionOptions instanceof ObjectRef) {
    return connectionOptions;
  }
  const userFields = (connectionOptions as { fields?: (t: unknown) => Record<string, unknown> })
    .fields;
  return {
    ...connectionOptions,
    // User fields merge AFTER totalCount so a user-declared totalCount wins.
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
