/* eslint-disable no-param-reassign */
import {
  BasePlugin,
  ResolveValueWrapper,
  ImplementedType,
  Field,
  TypeParam,
  BuildCache,
} from '@giraphql/core';
import './global-types';
import { GraphQLResolveInfo, GraphQLFieldConfig } from 'graphql';
import MergedAsyncIterator from './merged-iterator';
import SubscriptionManager from './manager';

export { MergedAsyncIterator, SubscriptionManager };

export function rootName(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return rootName(path.prev);
  }

  return String(path.key);
}

export default class SmartSubscriptionsPlugin<Context extends object> implements BasePlugin {
  managerMap = new WeakMap<Context, Map<string, SubscriptionManager>>();

  subscribe: (name: string, context: Context) => AsyncIterator<unknown>;

  constructor(options: { subscribe: (name: string, context: Context) => AsyncIterator<unknown> }) {
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
            const manager = new SubscriptionManager(subName => this.subscribe(subName, context));

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
    cache: BuildCache,
  ) {
    data.smartSubscriptions = { subscriptionByType: {} };

    const nonListType = Array.isArray(field.type) ? field.type[0] : field.type;
    const typename = typeof nonListType === 'object' ? nonListType.typename : nonListType;
    const fieldType = cache.getEntry(typename);

    if (fieldType.kind === 'Object') {
      data.smartSubscriptions.objectSubscription = fieldType.type.options.subscribe;
    } else if (fieldType.kind === 'Interface') {
      const implementers = cache.getImplementers(typename);

      implementers.forEach(obj => {
        data.smartSubscriptions!.subscriptionByType[obj.typename] = obj.options.subscribe;
      });
    } else if (fieldType.kind === 'Union') {
      fieldType.type.members.forEach(memberName => {
        data.smartSubscriptions!.subscriptionByType[memberName] = cache.getEntryOfType(
          memberName,
          'Object',
        ).type.options.subscribe;
      });
    }

    if (field.parentTypename === 'Subscription') {
      const queryFields = cache.getFields('Query');
      const queryField = queryFields[name];
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
    const type = cache.getEntry(field.parentTypename);

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
      data.smartSubscriptions.subscribe = options.subscribe;
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

    if (manager && data.smartSubscriptions.subscribe) {
      data.smartSubscriptions.subscribe(manager, parent.value, args, context, info);
    }

    if (!data.smartSubscriptions.objectSubscription || !manager) {
      return {};
    }

    return {
      onWrap: (child: ResolveValueWrapper) => {
        if (manager) {
          // eslint-disable-next-line no-unused-expressions
          data.smartSubscriptions.objectSubscription?.(manager, child.value, context, info);
        }

        child.data.smartSubscriptions = data.smartSubscriptions;
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

    if (manager && subscribe) {
      subscribe(manager, parent.value, context, info);
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

    if (manager && subscribe) {
      subscribe(manager, parent.value, context, info);
    }
  }
}
