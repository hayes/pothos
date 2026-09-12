import { isThenable, type SchemaTypes } from '@pothos/core';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type SubscriptionCache from './cache.js';
import type { FieldSubscriber } from './types.js';

export default function resolveWithCache<Types extends SchemaTypes>(
  cache: SubscriptionCache<Types>,
  subscribe: FieldSubscriber<Types> | null,
  resolve: GraphQLFieldResolver<unknown, object>,
  canRefetch: boolean,
  parent: unknown,
  args: object,
  context: object,
  info: GraphQLResolveInfo,
) {
  const key = cache.cacheKey(info.path);

  const existingCacheNode = cache.get(key, true);

  if (existingCacheNode) {
    return existingCacheNode.value;
  }

  const parentSubscriber = cache.getTypeSubscriber(info.parentType.name);

  if (parentSubscriber) {
    const parentManager = cache.managerForParentType(info);

    if (parentManager) {
      parentSubscriber(parentManager, parent, context, info);
    }
  }

  const resultOrPromise = resolve(parent, args, context, info);

  function cacheResult(result: unknown) {
    const cacheNode = cache.add(info, key, canRefetch, result);

    const sub = subscribe?.(cacheNode.managerForField(), parent, args, context, info);

    // The cache node may have normalized the resolved value (see normalizeListValue), and execution
    // needs to use the same value that will be refetched into later.
    if (isThenable(sub)) {
      return sub.then(() => cacheNode.value);
    }

    return cacheNode.value;
  }

  return isThenable(resultOrPromise)
    ? resultOrPromise.then(cacheResult)
    : cacheResult(resultOrPromise);
}
