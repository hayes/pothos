import { type MaybePromise, PothosValidationError, type SchemaTypes } from '@pothos/core';
import type SubscriptionCache from './cache.js';
import FieldSubscriptionManager from './manager/field.js';
import TypeSubscriptionManager from './manager/type.js';

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

    for (const manager of this.typeManagers.values()) {
      manager.reRegister();
    }
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
      const list = this.valueAsList();

      this.cache.invalidPaths.push(`${this.path}.${key}`);
      list[key] = value;
    } else {
      this.cache.invalidPaths.push(`${this.path}.`);
      this.value = value;
    }

    this.typeManagers.delete(key);
  }

  /**
   * List values are normally materialized into an array before they are cached, but a node may be
   * created with any iterable, so fall back to materializing it here. This only recovers every
   * entry for iterables that can be iterated more than once.
   */
  private valueAsList(): unknown[] {
    if (Array.isArray(this.value)) {
      return this.value as unknown[];
    }

    if (
      typeof this.value === 'object' &&
      this.value !== null &&
      Symbol.iterator in this.value &&
      typeof (this.value as Iterable<unknown>)[Symbol.iterator] === 'function'
    ) {
      const list = [...(this.value as Iterable<unknown>)];

      this.value = list;

      return list;
    }

    throw new PothosValidationError(
      'Expected value of CacheNode for list path to be an array or iterable',
    );
  }
}
