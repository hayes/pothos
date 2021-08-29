import { MaybePromise, SchemaTypes } from '@giraphql/core';
import SubscriptionCache from './cache';
import { FieldSubscriptionManager, TypeSubscriptionManager } from '.';

export default class CacheNode<Types extends SchemaTypes> {
  path: string;

  value: unknown;

  fieldManager: FieldSubscriptionManager<Types> | null = null;

  typeManagers = new Map<number | string, TypeSubscriptionManager>();

  cache: SubscriptionCache<Types>;

  refetch: () => MaybePromise<void>;

  constructor(
    cache: SubscriptionCache<Types>,
    path: string,
    value: unknown,
    refetch: () => MaybePromise<void>,
  ) {
    this.cache = cache;
    this.path = path;
    this.value = value;
    this.refetch = refetch;
  }

  reRegister() {
    if (this.fieldManager) {
      this.fieldManager.reRegister();
    }

    this.typeManagers.forEach((manager) => void manager.reRegister());
  }

  managerForField() {
    this.fieldManager = new FieldSubscriptionManager(this.cache.manager, this);

    return this.fieldManager;
  }

  managerForType(key: number | string) {
    if (this.typeManagers.has(key)) {
      return null;
    }

    const typeManager = new TypeSubscriptionManager(
      this.cache.manager,
      (value) => {
        this.replaceValue(value, key);
      },
      this.refetch,
    );

    this.typeManagers.set(key, typeManager);

    return typeManager;
  }

  replaceValue(value: unknown, key: number | string) {
    if (typeof key === 'number') {
      if (!Array.isArray(this.value)) {
        throw new TypeError('Expected value of CacheNode for list path to be an array');
      }

      this.cache.invalidPaths.push(`${this.path}.${key}`);
      this.value[key] = value;
    } else {
      this.cache.invalidPaths.push(`${this.path}.`);
      this.value = value;
    }

    this.typeManagers.delete(key);
  }
}
