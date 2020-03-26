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
import { GraphQLResolveInfo, GraphQLFieldConfig, GraphQLFieldResolver } from 'graphql';
import MergedAsyncIterator from './merged-iterator';
import SubscriptionManager from './manager';
import FieldSubscriptionManager, { RegisterFieldSubscriptionOptions } from './manager/field';
import TypeSubscriptionManager, { RegisterTypeSubscriptionOptions } from './manager/type';

export {
  MergedAsyncIterator,
  SubscriptionManager,
  TypeSubscriptionManager,
  FieldSubscriptionManager,
  RegisterFieldSubscriptionOptions,
  RegisterTypeSubscriptionOptions,
};

export interface SmartSubscriptionOptions<Context extends object> {
  subscribe: (name: string, context: Context) => AsyncIterator<unknown>;
}

export function rootName(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return rootName(path.prev);
  }

  return String(path.key);
}

export function stringPath(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return `${stringPath(path.prev)}.${path.key}`;
  }

  return String(path.key);
}

export type WrappedResolver<Context = object> = GraphQLFieldResolver<unknown, Context> & {
  unwrap: () => GraphQLFieldResolver<unknown, Context>;
};

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
    cache: BuildCache,
  ) {
    data.smartSubscriptions = { subscriptionByType: {}, canRefetch: false };

    const originalResolve = config.resolve!;

    const wrappedResolver: WrappedResolver<Context> = async (
      maybeWrappedParent,
      args,
      context,
      info,
    ) => {
      const parentWrapper = ResolveValueWrapper.wrap(maybeWrappedParent);
      const path = stringPath(info.path);

      if (parentWrapper.data.smartSubscriptions?.cache.has(path)) {
        return parentWrapper.data.smartSubscriptions.cache.get(path);
      }

      const result = await originalResolve(parentWrapper, args, context, info);

      // eslint-disable-next-line no-unused-expressions
      parentWrapper.data.smartSubscriptions?.cache.set(path, result);

      return result;
    };

    wrappedResolver.unwrap = () => (originalResolve as WrappedResolver).unwrap();

    config.resolve = wrappedResolver as WrappedResolver;

    const nonListType = Array.isArray(field.type) ? field.type[0] : field.type;
    const typename = typeof nonListType === 'object' ? nonListType.typename : nonListType;
    const fieldType = cache.getEntry(typename);

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

    const cache = new Map<string, unknown>();

    if (!parent.data.smartSubscriptions) {
      parent.data.smartSubscriptions = {
        cache,
        refetch: () => cache.delete(stringPath(info.path)),
        subscriptionByType: {},
      };
    }

    if (data.smartSubscriptions.canRefetch) {
      parent.data.smartSubscriptions.refetch = () => cache.delete(stringPath(info.path));
    }

    if (data.smartSubscriptions.subscribe) {
      data.smartSubscriptions.subscribe(
        manager.forField(parent.data.smartSubscriptions.refetch),
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
        child.data.smartSubscriptions = {
          parentPath: stringPath(info.path),
          subscriptionByType: data.smartSubscriptions.subscriptionByType,
          refetch: parent.data.smartSubscriptions!.refetch,
          cache: new Map(),
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
              cache.set(stringPath(info.path), cacheEntry);
            } else {
              const cacheResult = cache.get(stringPath(info.path));

              if (!cacheResult || !Array.isArray(cacheResult)) {
                throw new TypeError(`Expected cache for ${info.fieldName} to be an Array`);
              }

              cacheResult[index] = cacheEntry;
            }
          };

          child.data.smartSubscriptions.replace = replace;

          if (data.smartSubscriptions.objectSubscription) {
            data.smartSubscriptions.objectSubscription(
              manager.forType(replace, child.data.smartSubscriptions.refetch),
              child.value,
              context,
              info,
            );
          }
        }
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
      subscribe(
        manager.forType(
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

    if (manager && subscribe) {
      subscribe(
        manager.forType(
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
