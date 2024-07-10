/* eslint-disable logical-assignment-operators */
import { GraphQLResolveInfo } from 'graphql';
import {
  brandWithType,
  createContextCache,
  MaybePromise,
  ObjectParam,
  OutputType,
  PothosValidationError,
  SchemaTypes,
} from '@pothos/core';
import { NodeObjectOptions } from '../types';

const getRequestCache = createContextCache(() => new Map<string, MaybePromise<unknown>>());

export async function resolveNodes<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  globalIDs: ({ id: unknown; typename: string } | null | undefined)[],
): Promise<MaybePromise<unknown>[]> {
  const requestCache = getRequestCache(context);
  const idsByType: Record<string, Set<unknown>> = {};
  const results: Record<string, MaybePromise<unknown>> = {};

  globalIDs.forEach((globalID, i) => {
    if (globalID == null) {
      return;
    }

    const { id, typename } = globalID;
    const cacheKey = `${typename}:${id}`;

    if (requestCache.has(cacheKey)) {
      results[cacheKey] = requestCache.get(cacheKey)!;
      return;
    }

    idsByType[typename] = idsByType[typename] ?? new Set();
    idsByType[typename].add(id);
  });

  await Promise.all(
    Object.keys(idsByType).map(async (typename) => {
      const ids = [...idsByType[typename]];

      const config = builder.configStore.getTypeConfig(typename, 'Object');
      const options = config.pothosOptions as NodeObjectOptions<Types, ObjectParam<Types>, []>;
      const shouldBrandObjects =
        options.brandLoadedObjects ?? builder.options.relay?.brandLoadedObjects ?? true;

      const resultsForType = await resolveUncachedNodesForType(
        builder,
        context,
        info,
        ids,
        typename,
      );

      resultsForType.forEach((val, i) => {
        if (shouldBrandObjects) {
          brandWithType(val, typename as OutputType<Types>);
        }

        results[`${typename}:${ids[i]}`] = val;
      });
    }),
  );

  return globalIDs.map((globalID) =>
    globalID == null ? null : results[`${globalID.typename}:${globalID.id}`] ?? null,
  );
}

export async function resolveUncachedNodesForType<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  ids: readonly unknown[],
  type: OutputType<Types> | string,
): Promise<unknown[]> {
  const requestCache = getRequestCache(context);
  const config = builder.configStore.getTypeConfig(type, 'Object');
  const options = config.pothosOptions as NodeObjectOptions<Types, ObjectParam<Types>, [], unknown>;

  if (options.loadMany) {
    const loadManyPromise = Promise.resolve(options.loadMany(ids as unknown[], context));

    return Promise.all(
      ids.map((id, i) => {
        const entryPromise = loadManyPromise
          .then((results: readonly unknown[]) => results[i])
          .then((result: unknown) => {
            requestCache.set(`${config.name}:${id}`, result);

            return result;
          });

        requestCache.set(`${config.name}:${id}`, entryPromise);

        return entryPromise;
      }),
    );
  }

  if (options.loadOne) {
    return Promise.all(
      ids.map((id) => {
        const entryPromise = Promise.resolve(options.loadOne!(id, context)).then(
          (result: unknown) => {
            requestCache.set(`${config.name}:${id}`, result);

            return result;
          },
        );

        requestCache.set(`${config.name}:${id}`, entryPromise);

        return entryPromise;
      }),
    );
  }

  if (options.loadManyWithoutCache) {
    return options.loadManyWithoutCache(ids as unknown[], context) as unknown[];
  }

  if (options.loadWithoutCache) {
    return Promise.all(
      ids.map((id) => Promise.resolve(options.loadWithoutCache!(id, context, info))),
    );
  }

  throw new PothosValidationError(`${config.name} does not support loading by id`);
}
