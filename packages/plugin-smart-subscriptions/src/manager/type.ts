import { MaybePromise } from '@giraphql/core';
import { SubscriptionManager } from '..';
import { RegisterTypeSubscriptionOptions } from '../types';
import BaseSubscriptionManager from './base';

export default class TypeSubscriptionManager<
  ParentShape = unknown
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
          return Promise.resolve(refetch(value)).then(
            (result: unknown) => {
              this.replace(result);
            },
            (err: unknown) => {
              this.manager.handleError(err);
            },
          );
        }

        return this.refetchParent();
      },
    });
  }
}
