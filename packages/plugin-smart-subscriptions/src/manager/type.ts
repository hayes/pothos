import { MaybePromise } from '@giraphql/core';
import { SubscriptionManager } from '..';
import { IteratorFilterFunction, IteratorCacheInvalidator, RefetchFunction } from '.';

export interface RegisterTypeSubscriptionOptions<T, ParentShape> {
  refetch?: RefetchFunction<T, ParentShape>;
  filter?: IteratorFilterFunction<T>;
  invalidateCache?: IteratorCacheInvalidator<T>;
}

export default class TypeSubscriptionManager<ParentShape = unknown> {
  manager: SubscriptionManager;

  replace: (promise: MaybePromise<unknown>) => void;

  refetchParent: () => MaybePromise<void>;

  constructor(
    manager: SubscriptionManager,
    replace: (promise: MaybePromise<unknown>) => void,
    refetchParent: () => MaybePromise<void>,
  ) {
    this.manager = manager;
    this.replace = replace;
    this.refetchParent = refetchParent;
  }

  register<T = unknown>(
    name: string,
    { filter, invalidateCache, refetch }: RegisterTypeSubscriptionOptions<T, ParentShape> = {},
  ) {
    this.manager.register<T>(name, {
      filter,
      onValue: value => {
        if (invalidateCache) {
          invalidateCache(value);
        }

        if (refetch) {
          this.replace(refetch(value));
        } else {
          this.refetchParent();
        }
      },
    });
  }
}
