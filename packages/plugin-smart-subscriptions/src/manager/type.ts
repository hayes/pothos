import { MaybePromise } from '@giraphql/core';
import { SubscriptionManager } from '../index.js';
import { RegisterTypeSubscriptionOptions } from '../types.js';
import BaseSubscriptionManager from './base.js';

export default class TypeSubscriptionManager<
  ParentShape = unknown,
> extends BaseSubscriptionManager {
  replace: (value: unknown) => void;

  refetchParent: () => MaybePromise<void>;

  constructor(
    manager: SubscriptionManager,
    replace: (value: unknown) => void,
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
          let resultOrPromise: MaybePromise<unknown>;
          try {
            resultOrPromise = refetch(value);
          } catch (error: unknown) {
            this.manager.handleError(error);
          }

          this.replace(resultOrPromise);

          return resultOrPromise as MaybePromise<void>;
        }

        return this.refetchParent();
      },
    });
  }
}
