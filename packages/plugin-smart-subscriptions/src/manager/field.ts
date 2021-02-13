import { SchemaTypes } from '@giraphql/core';
import CacheNode from '../cache-node';
import { RegisterFieldSubscriptionOptions } from '../types';
import BaseSubscriptionManager from './base';

import { SubscriptionManager } from '..';

export default class FieldSubscriptionManager<
  Types extends SchemaTypes
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
