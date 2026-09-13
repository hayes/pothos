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
import { getRawGlobalID } from './internal.js';

interface RequestCache {
  byParsedID: Map<string, Map<unknown, MaybePromise<unknown>>>;
  byRawID: Map<string, MaybePromise<unknown>>;
}

const getRequestCache = createContextCache(
  (): RequestCache => ({ byParsedID: new Map(), byRawID: new Map() }),
);

function getParsedIDCache(requestCache: RequestCache, typename: string) {
  let cache = requestCache.byParsedID.get(typename);

  if (!cache) {
    cache = new Map();
    requestCache.byParsedID.set(typename, cache);
  }

  return cache;
}

function rawCacheKey(typename: string, globalID: { id: unknown }) {
  const rawId = getRawGlobalID(globalID);

  return rawId === undefined ? undefined : `${typename}:${rawId}`;
}

interface PendingNodes {
  ids: unknown[];
  indexes: number[][];
  rawKeys: string[][];
  slotByParsedID: Map<unknown, number>;
  slotByRawKey: Map<string, number>;
}

export async function resolveNodes<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  globalIDs: ({ id: unknown; typename: string } | null | undefined)[],
): Promise<MaybePromise<unknown>[]> {
  const requestCache = getRequestCache(context);
  const results: MaybePromise<unknown>[] = globalIDs.map(() => null);
  const pendingByType = new Map<string, PendingNodes>();

  globalIDs.forEach((globalID, index) => {
    if (globalID == null) {
      return;
    }

    const { id, typename } = globalID;
    const rawKey = rawCacheKey(typename, globalID);

    if (rawKey !== undefined && requestCache.byRawID.has(rawKey)) {
      results[index] = requestCache.byRawID.get(rawKey)!;

      return;
    }

    const parsedCache = getParsedIDCache(requestCache, typename);

    if (parsedCache.has(id)) {
      const value = parsedCache.get(id)!;
      results[index] = value;

      if (rawKey !== undefined) {
        requestCache.byRawID.set(rawKey, value);
      }

      return;
    }

    let pending = pendingByType.get(typename);

    if (!pending) {
      pending = {
        ids: [],
        indexes: [],
        rawKeys: [],
        slotByParsedID: new Map(),
        slotByRawKey: new Map(),
      };
      pendingByType.set(typename, pending);
    }

    let slot = rawKey === undefined ? undefined : pending.slotByRawKey.get(rawKey);

    if (slot === undefined) {
      slot = pending.slotByParsedID.get(id);

      if (slot === undefined) {
        slot = pending.ids.length;
        pending.slotByParsedID.set(id, slot);
        pending.ids.push(id);
        pending.indexes.push([]);
        pending.rawKeys.push([]);
      }

      if (rawKey !== undefined) {
        pending.slotByRawKey.set(rawKey, slot);
        pending.rawKeys[slot].push(rawKey);
      }
    }

    pending.indexes[slot].push(index);
  });

  await Promise.all(
    [...pendingByType].map(async ([typename, pending]) => {
      const config = builder.configStore.getTypeConfig(typename, 'Object');
      const options = config.pothosOptions as NodeObjectOptions<Types, ObjectParam<Types>, []>;
      const shouldBrandObjects =
        options.brandLoadedObjects ?? builder.options.relay?.brandLoadedObjects ?? true;
      const cachesResults = !!(options.loadMany ?? options.loadOne);

      const resultsForType = await resolveUncachedNodesForType(
        builder,
        context,
        info,
        pending.ids,
        typename,
        pending.rawKeys.map((keys) => keys[0]),
      );

      resultsForType.forEach((val, slot) => {
        if (shouldBrandObjects) {
          brandWithType(val, typename as OutputType<Types>);
        }

        for (const index of pending.indexes[slot]) {
          results[index] = val;
        }

        if (cachesResults) {
          for (const rawKey of pending.rawKeys[slot]) {
            requestCache.byRawID.set(rawKey, val);
          }
        }
      });
    }),
  );

  return results;
}

// biome-ignore lint/suspicious/useAwait: ensure that this returns a promise
export async function resolveUncachedNodesForType<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  ids: readonly unknown[],
  type: OutputType<Types> | string,
  keys?: readonly (string | undefined)[],
): Promise<unknown[]> {
  const requestCache = getRequestCache(context);
  const config = builder.configStore.getTypeConfig(type, 'Object');
  const options = config.pothosOptions as NodeObjectOptions<Types, ObjectParam<Types>, [], unknown>;
  const parsedCache = getParsedIDCache(requestCache, config.name);
  const setCache = (id: unknown, i: number, value: MaybePromise<unknown>) => {
    const rawKey = keys?.[i];

    if (rawKey !== undefined) {
      requestCache.byRawID.set(rawKey, value);
    }

    parsedCache.set(id, value);
  };

  if (options.loadMany) {
    const loadManyPromise = Promise.resolve(options.loadMany(ids as unknown[], context));

    return Promise.all(
      ids.map((id, i) => {
        const entryPromise = loadManyPromise
          .then((results: readonly unknown[]) => results[i])
          .then((result: unknown) => {
            setCache(id, i, result);

            return result;
          });

        setCache(id, i, entryPromise);

        return entryPromise;
      }),
    );
  }

  if (options.loadOne) {
    return Promise.all(
      ids.map((id, i) => {
        const entryPromise = Promise.resolve(options.loadOne!(id, context)).then(
          (result: unknown) => {
            setCache(id, i, result);

            return result;
          },
        );

        setCache(id, i, entryPromise);

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
