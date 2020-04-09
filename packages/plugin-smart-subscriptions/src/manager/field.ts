import { MaybePromise } from '@giraphql/core';
import { SubscriptionManager } from '..';
import { RegisterFieldSubscriptionOptions } from '../types';
import BaseSubscriptionManager from './base';

export default class FieldSubscriptionManager extends BaseSubscriptionManager {
  refetch: () => MaybePromise<void>;

  constructor(manager: SubscriptionManager, refetch: () => MaybePromise<void>) {
    super(manager);

    this.refetch = refetch;
  }

  register<T>(name: string, { filter, invalidateCache }: RegisterFieldSubscriptionOptions<T> = {}) {
    this.addRegistration<T>({
      name,
      filter,
      onValue: (value) => {
        if (invalidateCache) {
          invalidateCache(value);
        }

        return this.refetch();
      },
    });
  }
}
