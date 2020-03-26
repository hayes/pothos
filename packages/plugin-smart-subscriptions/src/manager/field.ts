import { MaybePromise } from '@giraphql/core';
import { SubscriptionManager } from '..';
import { IteratorFilterFunction, IteratorCacheInvalidator } from '.';

export interface RegisterFieldSubscriptionOptions<T> {
  filter?: IteratorFilterFunction<T>;
  invalidateCache?: IteratorCacheInvalidator<T>;
}

export default class FieldSubscriptionManager {
  manager: SubscriptionManager;

  refetch: () => MaybePromise<void>;

  constructor(manager: SubscriptionManager, refetch: () => MaybePromise<void>) {
    this.manager = manager;
    this.refetch = refetch;
  }

  register<T>(name: string, { filter, invalidateCache }: RegisterFieldSubscriptionOptions<T> = {}) {
    this.manager.register<T>(name, {
      filter,
      onValue: value => {
        if (invalidateCache) {
          invalidateCache(value);
        }

        return this.refetch();
      },
    });
  }
}
