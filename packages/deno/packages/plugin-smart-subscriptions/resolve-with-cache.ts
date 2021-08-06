// @ts-nocheck
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { isThenable, SchemaTypes } from '../core/index.ts';
import { SubscriptionCache } from './index.ts';
import { FieldSubscriber } from './types.ts';
export default function resolveWithCache<Types extends SchemaTypes>(cache: SubscriptionCache<Types>, subscribe: FieldSubscriber<Types> | null, resolve: GraphQLFieldResolver<unknown, object>, canRefetch: boolean, parent: unknown, args: object, context: object, info: GraphQLResolveInfo) {
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
    const resultOrPromise = resolve(parent, args, context, info) as unknown;
    function cacheResult(result: unknown) {
        const cacheNode = cache.add(info, key, canRefetch, result);
        subscribe?.(cacheNode.managerForField(), parent, args, context, info);
        return result;
    }
    return isThenable(resultOrPromise)
        ? resultOrPromise.then(cacheResult)
        : cacheResult(resultOrPromise);
}
