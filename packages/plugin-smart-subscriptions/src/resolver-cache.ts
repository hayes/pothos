/* eslint-disable max-classes-per-file */
import { GraphQLResolveInfo, GraphQLFieldResolver } from 'graphql';
import { MaybePromise } from '@giraphql/core';
import { FieldSubscriptionManager, TypeSubscriptionManager, SubscriptionManager } from '.';
import { stringPath } from './utils';

export class CacheForField {
  result: unknown;

  reRegister() {
    this.fieldManagers.forEach(manager => manager.reRegister());
    this.typeManagers.forEach(manager => manager.reRegister());
  }

  fieldManagers: FieldSubscriptionManager[] = [];

  typeManagers: TypeSubscriptionManager[] = [];
}

export default class ResolverCache {
  fields = new Map<string, CacheForField>();

  managerForField(
    info: GraphQLResolveInfo,
    manager: SubscriptionManager,
    refetch: () => MaybePromise<void>,
  ) {
    const path = stringPath(info.path);
    const fieldManager = new FieldSubscriptionManager(manager, refetch);

    this.getOrCreate(path).fieldManagers.push(fieldManager);

    return fieldManager;
  }

  managerForType(
    info: GraphQLResolveInfo,
    manager: SubscriptionManager,
    replace: (promise: MaybePromise<unknown>) => void,
    refetchParent: () => MaybePromise<void>,
  ) {
    const path = stringPath(info.path);
    const typeManager = new TypeSubscriptionManager(manager, replace, refetchParent);

    this.getOrCreate(path);

    return typeManager;
  }

  has(path: string) {
    return this.fields.has(path);
  }

  get(path: string) {
    return this.fields.get(path);
  }

  delete(info: GraphQLResolveInfo) {
    const path = stringPath(info.path);

    return this.fields.delete(path);
  }

  getOrCreate(path: string) {
    if (this.fields.has(path)) {
      return this.fields.get(path)!;
    }

    const cache = new CacheForField();
    this.fields.set(path, cache);

    return cache;
  }

  setResult(path: string, result: unknown) {
    this.getOrCreate(path).result = result;
  }

  async resolve(
    parent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
    resolver: GraphQLFieldResolver<unknown, object>,
  ) {
    const path = stringPath(info.path);

    if (this.has(path)) {
      const cache = this.get(path)!;

      cache.reRegister();

      return cache.result;
    }

    const result = await resolver(parent, args, context, info);

    this.setResult(path, result);

    return result;
  }

  replace(cacheEntry: MaybePromise<unknown>, info: GraphQLResolveInfo, index: null | number) {
    const path = stringPath(info.path);

    if (index === null) {
      this.setResult(path, cacheEntry);
    } else {
      const cacheResult = this.get(path)?.result;

      if (!cacheResult || !Array.isArray(cacheResult)) {
        throw new TypeError(
          `Expected cache for ${info.parentType.name}.${info.fieldName} to be an Array`,
        );
      }

      cacheResult[index] = cacheEntry;
    }
  }
}
