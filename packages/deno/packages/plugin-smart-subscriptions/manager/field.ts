// @ts-nocheck
import type { SchemaTypes } from '../../core/index.ts';
import type CacheNode from '../cache-node.ts';
import type { RegisterFieldSubscriptionOptions } from '../types.ts';
import BaseSubscriptionManager from './base.ts';
import type SubscriptionManager from './index.ts';
export default class FieldSubscriptionManager<Types extends SchemaTypes> extends BaseSubscriptionManager {
    cacheNode: CacheNode<Types>;
    constructor(manager: SubscriptionManager, cacheNode: CacheNode<Types>) {
        super(manager);
        this.cacheNode = cacheNode;
    }
    register<T>(name: string, { filter, invalidateCache }: RegisterFieldSubscriptionOptions<T> = {}) {
        this.addRegistration<T>({
            name,
            filter,
            onValue: (value) => {
                if (invalidateCache) {
                    invalidateCache(value);
                }
                return this.cacheNode.refetch();
            },
        });
    }
}
