import { type SchemaTypes, isThenable } from '@pothos/core';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type SubscriptionCache from './cache';
import type { FieldSubscriber } from './types';

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

    if (isThenable(sub)) {
      return sub.then(() => result);
    }

    return result;
  }

  return isThenable(resultOrPromise)
    ? resultOrPromise.then(cacheResult)
    : cacheResult(resultOrPromise);
}
