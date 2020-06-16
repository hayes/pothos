/* eslint-disable no-param-reassign */
import {
  BasePlugin,
  ResolveValueWrapper,
  BuildCache,
  MaybePromise,
  getQueryFieldOptions,
} from '@giraphql/core';
import './global-types';
import {
  GraphQLResolveInfo,
  GraphQLFieldConfig,
  GraphQLObjectType,
  GraphQLNamedType,
  GraphQLInterfaceType,
} from 'graphql';
import MergedAsyncIterator from './merged-iterator';
import SubscriptionManager from './manager';
import FieldSubscriptionManager from './manager/field';
import TypeSubscriptionManager from './manager/type';
import { SmartSubscriptionOptions } from './types';
import { rootName } from './utils';
import ResolverCache, { CacheForField } from './resolver-cache';
import BaseSubscriptionManager from './manager/base';
import wrapField from './wrap-field';
import createFieldData from './create-field-data';

export {
  MergedAsyncIterator,
  SubscriptionManager,
  BaseSubscriptionManager,
  TypeSubscriptionManager,
  FieldSubscriptionManager,
  ResolverCache,
  CacheForField,
};

export * from './types';
export * from './utils';

export default class SmartSubscriptionsPlugin<Context extends object> implements BasePlugin {
  managerMap = new WeakMap<object, Map<string, SubscriptionManager>>();

  debounceDelay: number | null;

  subscribe: (
    name: string,
    context: Context,
    cb: (err: unknown, data: unknown) => void,
  ) => Promise<void> | void;

  unsubscribe: (name: string, context: Context) => Promise<void> | void;

  constructor(options: SmartSubscriptionOptions<Context>) {
    this.subscribe = options.subscribe;
    this.unsubscribe = options.unsubscribe;
    this.debounceDelay = options.debounceDelay ?? 10;
  }

  onField(
    type: GraphQLNamedType,
    name: string,
    config: GraphQLFieldConfig<unknown, object>,
    builder: GiraphQLSchemaTypes.SchemaBuilder<any>,
  ) {
    if (type.name !== 'Query') {
      return;
    }

    const options = getQueryFieldOptions(type as GraphQLObjectType, config, name);

    if (options.smartSubscription) {
      builder.subscriptionFields((t) => ({
        [name]: t.field({
          ...options,
          subscribe: (parent, args, context, info) => {
            const manager = new SubscriptionManager({
              value: ResolveValueWrapper.wrap(parent),
              debounceDelay: this.debounceDelay,
              subscribe: (subName, cb) => this.subscribe(subName, context, cb),
              unsubscribe: (subName) => this.unsubscribe(subName, context),
            });

            this.setSubscriptionManager(manager, context, info);

            return manager;
          },
        }),
      }));
    }
  }

  setSubscriptionManager(manager: SubscriptionManager, context: object, info: GraphQLResolveInfo) {
    if (!this.managerMap.has(context)) {
      this.managerMap.set(context, new Map());
    }

    this.managerMap.get(context)!.set(rootName(info.path), manager);
  }

  getSubscriptionManager(context: object, info: GraphQLResolveInfo) {
    return this.managerMap.get(context)?.get(rootName(info.path));
  }

  onFieldWrap(
    type: GraphQLObjectType | GraphQLInterfaceType,
    name: string,
    config: GraphQLFieldConfig<unknown, object>,
    data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
    buildCache: BuildCache,
  ) {
    wrapField(config, (context, info) => this.getSubscriptionManager(context, info));

    createFieldData(type, name, config, data, buildCache);
  }

  beforeResolve(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: Context,
    info: GraphQLResolveInfo,
  ) {
    const manager = this.getSubscriptionManager(context, info);

    if (!manager) {
      return {};
    }

    if (!parent.data.smartSubscriptions) {
      throw new Error(
        `Smart subscription data not initialized for ${info.parentType.name}.${info.fieldName}`,
      );
    }

    const { cache } = parent.data.smartSubscriptions;

    if (data.smartSubscriptions.canRefetch) {
      parent.data.smartSubscriptions.refetch = () => cache.delete(info);
    }

    if (data.smartSubscriptions.subscribe) {
      data.smartSubscriptions.subscribe(
        cache.managerForField(info, manager, parent.data.smartSubscriptions.refetch),
        parent.value,
        args,
        context,
        info,
      );
    }

    return {
      onWrap: (
        child: ResolveValueWrapper,
        index: number | null,
        wrapChild: (child: unknown) => MaybePromise<ResolveValueWrapper>,
      ) => {
        const childCache = new ResolverCache();
        child.data.smartSubscriptions = {
          subscriptionByType: data.smartSubscriptions.subscriptionByType,
          refetch: parent.data.smartSubscriptions!.refetch,
          cache: childCache,
        };

        if (
          manager &&
          parent &&
          (data.smartSubscriptions.objectSubscription ||
            Object.keys(data.smartSubscriptions.subscriptionByType).length !== 0)
        ) {
          child.data.smartSubscriptions.typeSubscriptionManager = childCache.managerForType(
            info,
            manager,
            (promise) => {
              const cacheEntry = Promise.resolve(promise).then((value) => wrapChild(value));

              cache.replace(cacheEntry, info, index);
            },
            child.data.smartSubscriptions.refetch,
          );

          if (data.smartSubscriptions.objectSubscription) {
            data.smartSubscriptions.objectSubscription(
              child.data.smartSubscriptions.typeSubscriptionManager,
              child.value,
              context,
              info,
            );
          }
        }
      },
    };
  }

  beforeSubscribe(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: Context,
    info: GraphQLResolveInfo,
  ): MaybePromise<{
    onWrap?(child: ResolveValueWrapper): MaybePromise<void>;
  }> {
    const cache = new ResolverCache();

    return {
      onWrap: (child) => {
        const manager = this.getSubscriptionManager(context, info);

        if (!manager) {
          return;
        }

        child.data.smartSubscriptions = {
          cache,
          refetch: () => cache.delete(info),
          subscriptionByType: {},
        };
      },
    };
  }

  onInterfaceResolveType(
    type: GraphQLObjectType,
    parent: ResolveValueWrapper,
    context: Context,
    info: GraphQLResolveInfo,
  ) {
    const manager = this.getSubscriptionManager(context, info);
    const subscribe = parent.data.smartSubscriptions?.subscriptionByType[type.name];
    const cache = parent.data.smartSubscriptions?.cache;

    if (manager && cache && subscribe) {
      subscribe(
        parent.data.smartSubscriptions!.typeSubscriptionManager!,
        parent.value,
        context,
        info,
      );
    }
  }

  onUnionResolveType(
    type: GraphQLNamedType,
    parent: ResolveValueWrapper,
    context: Context,
    info: GraphQLResolveInfo,
  ) {
    const manager = this.getSubscriptionManager(context, info);
    const subscribe = parent.data.smartSubscriptions?.subscriptionByType[type.name];
    const cache = parent.data.smartSubscriptions?.cache;

    if (manager && cache && subscribe) {
      subscribe(
        parent.data.smartSubscriptions!.typeSubscriptionManager!,
        parent.value,
        context,
        info,
      );
    }
  }
}
