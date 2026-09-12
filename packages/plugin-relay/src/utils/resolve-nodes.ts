import {
  brandWithType,
  createContextCache,
  type MaybePromise,
  type ObjectParam,
  type OutputType,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { NodeObjectOptions } from '../types.js';

const getRequestCache = createContextCache(() => new Map<string, MaybePromise<unknown>>());

function nodeCacheKey(typename: string, globalID: { id: unknown; rawId?: string }) {
  return `${typename}:${globalID.rawId ?? globalID.id}`;
}

export async function resolveNodes<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  globalIDs: ({ id: unknown; rawId?: string; typename: string } | null | undefined)[],
): Promise<MaybePromise<unknown>[]> {
  const requestCache = getRequestCache(context);
  const idsByType = new Map<string, Map<string, unknown>>();
  const results = new Map<string, MaybePromise<unknown>>();

  for (const globalID of globalIDs) {
    if (globalID == null) {
      continue;
    }

    const { id, typename } = globalID;
    const cacheKey = nodeCacheKey(typename, globalID);

    if (requestCache.has(cacheKey)) {
      results.set(cacheKey, requestCache.get(cacheKey)!);
      continue;
    }

    let idsForType = idsByType.get(typename);

    if (!idsForType) {
      idsForType = new Map();
      idsByType.set(typename, idsForType);
    }

    idsForType.set(cacheKey, id);
  }

  await Promise.all(
    [...idsByType].map(async ([typename, idsForType]) => {
      const ids = [...idsForType.values()];
      const keys = [...idsForType.keys()];

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
        keys,
      );

      resultsForType.forEach((val, i) => {
        if (shouldBrandObjects) {
          brandWithType(val, typename as OutputType<Types>);
        }

        results.set(keys[i], val);
      });
    }),
  );

  return globalIDs.map((globalID) =>
    globalID == null ? null : (results.get(nodeCacheKey(globalID.typename, globalID)) ?? null),
  );
}

// biome-ignore lint/suspicious/useAwait: ensure that this returns a promise
export async function resolveUncachedNodesForType<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  ids: readonly unknown[],
  type: OutputType<Types> | string,
  /**
   * Request cache keys for each entry of `ids`, in the same order. Defaults to
   * `${typename}:${id}`.
   */
  keys?: readonly string[],
): Promise<unknown[]> {
  const requestCache = getRequestCache(context);
  const config = builder.configStore.getTypeConfig(type, 'Object');
  const options = config.pothosOptions as NodeObjectOptions<Types, ObjectParam<Types>, [], unknown>;
  const cacheKey = (id: unknown, i: number) => keys?.[i] ?? `${config.name}:${id}`;

  if (options.loadMany) {
    const loadManyPromise = Promise.resolve(options.loadMany(ids as unknown[], context));

    return Promise.all(
      ids.map((id, i) => {
        const key = cacheKey(id, i);
        const entryPromise = loadManyPromise
          .then((results: readonly unknown[]) => results[i])
          .then((result: unknown) => {
            requestCache.set(key, result);

            return result;
          });

        requestCache.set(key, entryPromise);

        return entryPromise;
      }),
    );
  }

  if (options.loadOne) {
    return Promise.all(
      ids.map((id, i) => {
        const key = cacheKey(id, i);
        const entryPromise = Promise.resolve(options.loadOne!(id, context)).then(
          (result: unknown) => {
            requestCache.set(key, result);

            return result;
          },
        );

        requestCache.set(key, entryPromise);

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
