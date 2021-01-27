import { isThenable, SchemaTypes } from '@giraphql/core';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import { SubscriptionCache } from '.';
import { FieldSubscriber } from './types';

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

  const parentManager = cache.managerForParentType(info);

  if (parentManager) {
    cache.getTypeSubscriber(info.parentType.name)?.(parentManager, parent, context, info);
  }

  const resultOrPromise = resolve(parent, args, context, info) as unknown;

  return isThenable(resultOrPromise)
    ? resultOrPromise.then(cacheResult)
    : cacheResult(resultOrPromise);

  function cacheResult(result: unknown) {
    const cacheNode = cache!.add(info, key, canRefetch, result);

    subscribe?.(cacheNode.managerForField(), parent, args, context, info);

    return result;
  }
}
