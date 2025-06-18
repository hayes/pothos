import type { SchemaTypes } from '@pothos/core';
import type CacheNode from '../cache-node';
import type { RegisterFieldSubscriptionOptions } from '../types';
import type SubscriptionManager from '.';
import BaseSubscriptionManager from './base';

export default class FieldSubscriptionManager<
  Types extends SchemaTypes,
> extends BaseSubscriptionManager {
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
