/* eslint-disable no-param-reassign */
import {
  BasePlugin,
  ResolveValueWrapper,
  ImplementedType,
  Field,
  TypeParam,
  BuildCache,
  MaybePromise,
} from '@giraphql/core';
import './global-types';
import { GraphQLResolveInfo, GraphQLFieldConfig } from 'graphql';
import MergedAsyncIterator from './merged-iterator';
import SubscriptionManager from './manager';
import FieldSubscriptionManager from './manager/field';
import TypeSubscriptionManager from './manager/type';
import { SmartSubscriptionOptions, WrappedResolver } from './types';
import { rootName } from './utils';
import ResolverCache, { CacheForField } from './resolver-cache';
import BaseSubscriptionManager from './manager/base';

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
  managerMap = new WeakMap<Context, Map<string, SubscriptionManager>>();

  subscribe: (name: string, context: Context) => AsyncIterator<unknown>;

  constructor(options: SmartSubscriptionOptions<Context>) {
    this.subscribe = options.subscribe;
  }

  onField(
    type: ImplementedType,
    name: string,
    field: Field<{}, any, TypeParam<any>>,
    builder: GiraphQLSchemaTypes.SchemaBuilder<any>,
  ) {
    if (type.kind !== 'Query') {
      return;
    }

    const options = field.options as GiraphQLSchemaTypes.QueryFieldOptions<
      any,
      TypeParam<any>,
      any,
      {}
    >;

    if (options.smartSubscription) {
      builder.subscriptionFields(t => ({
        [name]: t.field({
          ...options,
          subscribe: (parent, args, context, info) => {
            const manager = new SubscriptionManager(ResolveValueWrapper.wrap(parent), subName =>
              this.subscribe(subName, context),
            );

            this.setSubscriptionManager(manager, context, info);

            return manager;
          },
        }),
      }));
    }
  }

  setSubscriptionManager(manager: SubscriptionManager, context: Context, info: GraphQLResolveInfo) {
    if (!this.managerMap.has(context)) {
      this.managerMap.set(context, new Map());
    }

    this.managerMap.get(context)!.set(rootName(info.path), manager);
  }

  getSubscriptionManager(context: Context, info: GraphQLResolveInfo) {
    return this.managerMap.get(context)?.get(rootName(info.path));
  }

  onFieldWrap(
    name: string,
    field: Field<{}, any, TypeParam<any>>,
    config: GraphQLFieldConfig<unknown, object>,
    data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
    buildCache: BuildCache,
  ) {
    data.smartSubscriptions = { subscriptionByType: {}, canRefetch: false };

    const originalResolve = config.resolve!;

    const wrappedResolver: WrappedResolver<Context> = (maybeWrappedParent, args, context, info) => {
      if (!this.getSubscriptionManager(context, info)) {
        return originalResolve(maybeWrappedParent, args, context, info);
      }

      const parentWrapper = ResolveValueWrapper.wrap(maybeWrappedParent);

      const { cache } = parentWrapper.data.smartSubscriptions!;

      return cache.resolve(parentWrapper, args, context, info, originalResolve);
    };

    wrappedResolver.unwrap = () => (originalResolve as WrappedResolver).unwrap();

    config.resolve = wrappedResolver as WrappedResolver;

    const nonListType = Array.isArray(field.type) ? field.type[0] : field.type;
    const typename = typeof nonListType === 'object' ? nonListType.typename : nonListType;
    const fieldType = buildCache.getEntry(typename);

    if (fieldType.kind === 'Object') {
      data.smartSubscriptions.objectSubscription = fieldType.type.options.subscribe;
      data.smartSubscriptions.canRefetch =
        (field.options as GiraphQLSchemaTypes.ObjectFieldOptions<
          any,
          {},
          TypeParam<any>,
          boolean,
          {}
        >).canRefetch || false;
    } else if (fieldType.kind === 'Interface') {
      const implementers = buildCache.getImplementers(typename);

      implementers.forEach(obj => {
        data.smartSubscriptions!.subscriptionByType[obj.typename] = obj.options.subscribe;
      });
    } else if (fieldType.kind === 'Union') {
      fieldType.type.members.forEach(memberName => {
        data.smartSubscriptions!.subscriptionByType[memberName] = buildCache.getEntryOfType(
          memberName,
          'Object',
        ).type.options.subscribe;
      });
    }

    if (field.parentTypename === 'Subscription') {
      const queryFields = buildCache.getFields('Query');

      const queryField = queryFields[name];

      if (!queryField) {
        return;
      }

      const options = queryField.options as GiraphQLSchemaTypes.QueryFieldOptions<
        any,
        TypeParam<any>,
        boolean,
        {}
      >;

      if (options.subscribe && options.smartSubscription) {
        data.smartSubscriptions.subscribe = options.subscribe;
      }

      return;
    }
    const type = buildCache.getEntry(field.parentTypename);

    if (type.kind !== 'Object') {
      return;
    }

    const options = field.options as GiraphQLSchemaTypes.ObjectFieldOptions<
      any,
      {},
      TypeParam<any>,
      boolean,
      {}
    >;

    if (options.subscribe) {
      data.smartSubscriptions.subscribe = options.subscribe as (
        subscriptions: FieldSubscriptionManager,
        parent: unknown,
        args: {},
        context: object,
        info: GraphQLResolveInfo,
      ) => void;
    }
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
          const replace = (promise: MaybePromise<unknown>) => {
            const cacheEntry = Promise.resolve(promise).then(value => wrapChild(value));

            if (index === null) {
              cache.setResult(info, cacheEntry);
            } else {
              const cacheResult = cache.get(info)?.result;

              if (!cacheResult || !Array.isArray(cacheResult)) {
                throw new TypeError(
                  `Expected cache for ${info.parentType.name}.${info.fieldName} to be an Array`,
                );
              }

              cacheResult[index] = cacheEntry;
            }
          };

          child.data.smartSubscriptions.replace = replace;

          if (data.smartSubscriptions.objectSubscription) {
            data.smartSubscriptions.objectSubscription(
              childCache.managerForType(
                info,
                manager,
                replace,
                child.data.smartSubscriptions.refetch,
              ),
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
      onWrap: child => {
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
    typename: string,
    parent: ResolveValueWrapper,
    context: Context,
    info: GraphQLResolveInfo,
  ) {
    const manager = this.getSubscriptionManager(context, info);
    const subscribe = parent.data.smartSubscriptions?.subscriptionByType[typename];
    const cache = parent.data.smartSubscriptions?.cache;

    if (manager && cache && subscribe) {
      subscribe(
        cache.managerForType(
          info,
          manager,
          parent.data.smartSubscriptions?.replace!,
          parent.data.smartSubscriptions?.refetch!,
        ),
        parent.value,
        context,
        info,
      );
    }
  }

  onUnionResolveType(
    typename: string,
    parent: ResolveValueWrapper,
    context: Context,
    info: GraphQLResolveInfo,
  ) {
    const manager = this.getSubscriptionManager(context, info);
    const subscribe = parent.data.smartSubscriptions?.subscriptionByType[typename];
    const cache = parent.data.smartSubscriptions?.cache;

    if (manager && cache && subscribe) {
      subscribe(
        cache.managerForType(
          info,
          manager,
          parent.data.smartSubscriptions?.replace!,
          parent.data.smartSubscriptions?.refetch!,
        ),
        parent.value,
        context,
        info,
      );
    }
  }
}
