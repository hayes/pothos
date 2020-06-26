/* eslint-disable max-classes-per-file */
import { GraphQLResolveInfo } from 'graphql';
import { MaybePromise } from '@giraphql/core';
import { FieldSubscriptionManager, TypeSubscriptionManager, SubscriptionManager } from '.';

export function keyFromPath(path: GraphQLResolveInfo['path']): string {
  return String(path.key);
}

export class CacheForField {
  reRegister() {
    this.fieldManagers.forEach((manager) => manager.reRegister());
    this.typeManagers.forEach((manager) => manager.reRegister());
  }

  fieldManagers: FieldSubscriptionManager[] = [];

  typeManagers: TypeSubscriptionManager[] = [];
}

export default class SubscriptionCache {
  fields = new Map<string, CacheForField>();

  managerForField(
    info: GraphQLResolveInfo,
    manager: SubscriptionManager,
    refetch: () => MaybePromise<void>,
  ) {
    const path = keyFromPath(info.path);
    const fieldManager = new FieldSubscriptionManager(manager, refetch);

    this.getOrCreateByPath(path).fieldManagers.push(fieldManager);

    return fieldManager;
  }

  managerForType(
    info: GraphQLResolveInfo,
    manager: SubscriptionManager,
    replace: (promise: MaybePromise<unknown>) => void,
    refetchParent: () => MaybePromise<void>,
  ) {
    const path = keyFromPath(info.path);
    const typeManager = new TypeSubscriptionManager(manager, replace, refetchParent);

    this.getOrCreateByPath(path).typeManagers.push(typeManager);

    return typeManager;
  }

  has(path: string) {
    return this.fields.has(path);
  }

  get(path: string) {
    return this.fields.get(path);
  }

  delete(info: GraphQLResolveInfo) {
    const path = keyFromPath(info.path);

    return this.fields.delete(path);
  }

  getOrCreate(info: GraphQLResolveInfo) {
    return this.getOrCreateByPath(keyFromPath(info.path));
  }

  getOrCreateByPath(path: string) {
    if (this.fields.has(path)) {
      return this.fields.get(path)!;
    }

    const cache = new CacheForField();
    this.fields.set(path, cache);

    return cache;
  }
}
