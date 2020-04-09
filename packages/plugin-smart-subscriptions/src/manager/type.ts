import { MaybePromise } from '@giraphql/core';
import { SubscriptionManager } from '..';
import { RegisterTypeSubscriptionOptions } from '../types';
import BaseSubscriptionManager from './base';

export default class TypeSubscriptionManager<
  ParentShape = unknown
> extends BaseSubscriptionManager {
  replace: (promise: MaybePromise<unknown>) => void;

  refetchParent: () => MaybePromise<void>;

  constructor(
    manager: SubscriptionManager,
    replace: (promise: MaybePromise<unknown>) => void,
    refetchParent: () => MaybePromise<void>,
  ) {
    super(manager);
    this.replace = replace;
    this.refetchParent = refetchParent;
  }

  register<T = unknown>(
    name: string,
    { filter, invalidateCache, refetch }: RegisterTypeSubscriptionOptions<T, ParentShape> = {},
  ) {
    this.addRegistration<T>({
      name,
      filter,
      onValue: (value) => {
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
