import {
  SchemaTypes,
  BaseFieldWrapper,
  GiraphQLOutputFieldConfig,
  GiraphQLObjectTypeConfig,
} from '@giraphql/core';
import './global-types';
import { GraphQLResolveInfo } from 'graphql';
import MergedAsyncIterator from './merged-iterator';
import SubscriptionManager from './manager';
import FieldSubscriptionManager from './manager/field';
import TypeSubscriptionManager from './manager/type';
import ResolverCache, { CacheForField } from './resolver-cache';
import BaseSubscriptionManager from './manager/base';
import SmartSubscriptionsPlugin from '.';
import { getFieldSubscribe } from './create-field-data';

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

type RequestData = {
  manager?: SubscriptionManager;
};
type ParentData = {
  cache: ResolverCache;
  reusableFields: Record<string, boolean>;
  refetch: () => void;
};

export default class SmartSubscriptionsFieldWrapper<
  Types extends SchemaTypes
> extends BaseFieldWrapper<Types, RequestData, ParentData> {
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  plugin: SmartSubscriptionsPlugin<Types>;

  subscribe?:
    | ((
        subscriptions: FieldSubscriptionManager,
        parent: unknown,
        args: {},
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => void)
    | null;

  subscriptionByType: {
    [k: string]:
      | undefined
      | ((
          subscriptions: TypeSubscriptionManager,
          parent: unknown,
          context: object,
          info: GraphQLResolveInfo,
        ) => void);
  } = {};

  canRefetch = false;

  constructor(field: GiraphQLOutputFieldConfig<Types>, plugin: SmartSubscriptionsPlugin<Types>) {
    super(field, 'GiraphQLSmartSubscriptions');

    this.builder = plugin.builder;
    this.plugin = plugin;

    this.subscribe = getFieldSubscribe(field, plugin);

    const returnType = this.builder.configStore.getTypeConfig(
      field.type.kind === 'List' ? field.type.type.ref : field.type.ref,
    );

    if (
      field.graphqlKind === 'Object' &&
      field.kind !== 'Query' &&
      field.kind !== 'Subscription' &&
      field.kind !== 'Mutation'
    ) {
      this.canRefetch = field.options.canRefetch ?? false;
    }

    if (
      returnType.graphqlKind === 'Object' &&
      returnType.kind !== 'Query' &&
      returnType.kind !== 'Subscription' &&
      returnType.kind !== 'Mutation'
    ) {
      this.subscriptionByType[returnType.name] = this.builder.configStore.getTypeConfig(
        field.parentType,
        'Object',
      ).giraphqlOptions.subscribe;
    } else if (returnType.graphqlKind === 'Interface') {
      const implementers = this.builder.configStore.getImplementers(returnType.name);

      implementers.forEach((obj) => {
        this.subscriptionByType[obj.name] = obj.giraphqlOptions.subscribe;
      });
    } else if (returnType.graphqlKind === 'Union') {
      returnType.types.forEach((member) => {
        const config = this.builder.configStore.getTypeConfig(member, 'Object');
        this.subscriptionByType[config.name] = config.giraphqlOptions.subscribe;
      });
    }
  }

  createRequestData() {
    return {};
  }

  allowReuse(
    requestData: RequestData,
    parentData: ParentData | null,
    parent: unknown,
    args: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) {
    return parentData?.reusableFields[info.path.key] === true;
  }

  beforeResolve(
    requestData: RequestData,
    parentData: ParentData | null,
    parent: unknown,
    args: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) {
    const { manager } = requestData;

    if (!parentData || !manager) {
      return {};
    }

    const { cache, reusableFields } = parentData;

    // if (this.subscribe) {
    //   this.subscribe(
    //     cache.managerForField(info, manager, parentData.refetch),
    //     parent,
    //     args,
    //     context,
    //     info,
    //   );
    // }

    return {
      onResolve: () => {
        reusableFields[info.path.key] = true;
      },
      onChild: (
        child: unknown,
        index: number | null,
        type: GiraphQLObjectTypeConfig,
      ): ParentData => {
        const childCache = new ResolverCache();

        const childData: ParentData = {
          cache: childCache,
          refetch: this.canRefetch
            ? () => {
                reusableFields[info.path.key] = false;
              }
            : parentData.refetch,
          reusableFields: {},
        };

        const subscribe = this.subscriptionByType[type.name];

        if (subscribe) {
          const typeSubscriptionManager = childCache.managerForType(
            info,
            manager,
            (promise) => {
              cache.replace(promise, info, index);
            },
            childData.refetch,
          );

          subscribe(typeSubscriptionManager, child, context, info);
        }

        return childData;
      },
    };
  }

  beforeSubscribe(
    requestData: RequestData,
    parent: unknown,
    args: object,
    context: object,
    info: GraphQLResolveInfo,
  ) {
    const cache = new ResolverCache();

    return {
      onSubscribe: (value: unknown) => {
        if (value instanceof SubscriptionManager) {
          // eslint-disable-next-line no-param-reassign
          requestData.manager = value;
        }
      },
      onValue: (value: unknown): ParentData | null => {
        if (requestData.manager) {
          const reusableFields: Record<string, boolean> = {};
          return {
            cache,
            refetch: () => {
              reusableFields[info.path.key] = false;
            },
            reusableFields,
          };
        }

        return null;
      },
    };
  }
}
