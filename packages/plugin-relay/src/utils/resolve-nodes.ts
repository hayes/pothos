import { MaybePromise, ObjectParam, OutputType, SchemaTypes } from '@giraphql/core';
import { NodeObjectOptions } from '../types';
import { internalDecodeGlobalID, internalEncodeGlobalID } from './internal';

const nodeCache = new WeakMap<object, Map<string, MaybePromise<unknown>>>();

function getRequestCache(context: object) {
  if (!nodeCache.has(context)) {
    nodeCache.set(context, new Map());
  }

  return nodeCache.get(context)!;
}

export async function resolveNodes<Types extends SchemaTypes>(
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  context: object,
  globalIDs: (string | null | undefined)[],
): Promise<MaybePromise<unknown>[]> {
  const requestCache = getRequestCache(context);
  const idsByType: Record<string, Set<string>> = {};

  globalIDs.forEach((globalID) => {
    if (globalID == null || requestCache.has(globalID)) {
      return;
    }

    const { id, typename } = internalDecodeGlobalID(builder, globalID);

    idsByType[typename] = idsByType[typename] || new Set();
    idsByType[typename].add(id);
  });

  await Promise.all([
    Object.keys(idsByType).map((typename) =>
      resolveUncachedNodesForType(builder, context, [...idsByType[typename]], typename),
    ),
  ]);

  return globalIDs.map((globalID) =>
    globalID == null ? null : requestCache.get(globalID) ?? null,
  );
}

export async function resolveUncachedNodesForType<Types extends SchemaTypes>(
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  context: object,
  ids: string[],
  type: OutputType<Types> | string,
): Promise<unknown[]> {
  const requestCache = getRequestCache(context);
  const config = builder.configStore.getTypeConfig(type, 'Object');
  const options = config.giraphqlOptions as NodeObjectOptions<Types, ObjectParam<Types>, []>;

  if (options.loadMany) {
    const loadManyPromise = Promise.resolve(options.loadMany(ids, context));

    return Promise.all(
      ids.map((id, i) => {
        const globalID = internalEncodeGlobalID(builder, config.name, id);
        const entryPromise = loadManyPromise
          .then((results: unknown[]) => results[i])
          .then((result: unknown) => {
            requestCache.set(globalID, result);

            return result;
          });

        requestCache.set(globalID, entryPromise);

        return entryPromise;
      }),
    );
  }

  if (options.loadOne) {
    return Promise.all(
      ids.map((id, i) => {
        const globalID = internalEncodeGlobalID(builder, config.name, id);
        const entryPromise = Promise.resolve(options.loadOne!(id, context)).then(
          (result: unknown) => {
            requestCache.set(globalID, result);

            return result;
          },
        );

        requestCache.set(globalID, entryPromise);

        return entryPromise;
      }),
    );
  }

  throw new Error(`${config.name} does not support loading by id`);
}
