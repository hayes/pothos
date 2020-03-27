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
    const fieldManager = new FieldSubscriptionManager(manager, refetch);

    this.getOrCreate(info).fieldManagers.push(fieldManager);

    return fieldManager;
  }

  managerForType(
    info: GraphQLResolveInfo,
    manager: SubscriptionManager,
    replace: (promise: MaybePromise<unknown>) => void,
    refetchParent: () => MaybePromise<void>,
  ) {
    const typeManager = new TypeSubscriptionManager(manager, replace, refetchParent);

    this.getOrCreate(info);

    return typeManager;
  }

  has(info: GraphQLResolveInfo) {
    const path = stringPath(info.path);

    return this.fields.has(path);
  }

  get(info: GraphQLResolveInfo) {
    const path = stringPath(info.path);

    return this.fields.get(path);
  }

  delete(info: GraphQLResolveInfo) {
    const path = stringPath(info.path);

    return this.fields.delete(path);
  }

  getOrCreate(info: GraphQLResolveInfo) {
    const path = stringPath(info.path);

    if (this.fields.has(path)) {
      return this.fields.get(path)!;
    }

    const cache = new CacheForField();
    this.fields.set(path, cache);

    return cache;
  }

  setResult(info: GraphQLResolveInfo, result: unknown) {
    this.getOrCreate(info).result = result;
  }

  async resolve(
    parent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
    resolver: GraphQLFieldResolver<unknown, object>,
  ) {
    if (this.has(info)) {
      const cache = this.get(info)!;

      cache.reRegister();

      return cache.result;
    }

    const result = await resolver(parent, args, context, info);

    this.setResult(info, result);

    return result;
  }
}
