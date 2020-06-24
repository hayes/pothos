import {
  SchemaTypes,
  BaseFieldWrapper,
  GiraphQLOutputFieldConfig,
  GiraphQLObjectTypeConfig,
} from '@giraphql/core';
import './global-types';
import { GraphQLResolveInfo } from 'graphql';
import SubscriptionManager from './manager';
import FieldSubscriptionManager from './manager/field';
import TypeSubscriptionManager from './manager/type';
import BaseSubscriptionManager from './manager/base';
import SmartSubscriptionsPlugin from '.';
import { getFieldSubscribe } from './create-field-data';
import SubscriptionCache, { CacheForField } from './cache';

export {
  SubscriptionManager,
  BaseSubscriptionManager,
  TypeSubscriptionManager,
  FieldSubscriptionManager,
  CacheForField,
  SubscriptionCache,
};

export * from './types';
export * from './utils';

type RequestData = {
  manager?: SubscriptionManager;
};
type ParentData = {
  cache: SubscriptionCache;
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
      this.canRefetch = field.giraphqlOptions.canRefetch ?? false;
    }

    if (
      returnType.graphqlKind === 'Object' &&
      returnType.kind !== 'Query' &&
      returnType.kind !== 'Subscription' &&
      returnType.kind !== 'Mutation'
    ) {
      this.subscriptionByType[returnType.name] = this.builder.configStore.getTypeConfig(
        returnType.name,
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

  private cacheKey(info: GraphQLResolveInfo) {
    return String(info.path.key);
  }

  allowReuse(
    requestData: RequestData,
    parentData: ParentData | null,
    parent: unknown,
    args: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) {
    const key = this.cacheKey(info);

    if (parentData?.cache.has(key)) {
      parentData.cache.get(key)!.reRegister();

      return true;
    }

    return false;
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

    const { cache } = parentData;

    const refetch = this.canRefetch ? () => cache.delete(info) : parentData.refetch;

    // need entry to allow reuse
    cache.getOrCreate(info);

    if (this.subscribe) {
      this.subscribe(cache.managerForField(info, manager, refetch), parent, args, context, info);
    }

    return {
      onChild: (
        child: unknown,
        index: number | null,
        type: GiraphQLObjectTypeConfig,
        update: (value: unknown) => void,
      ): ParentData => {
        const childCache = new SubscriptionCache();

        const childData: ParentData = {
          cache: childCache,
          refetch,
        };

        const subscribe = this.subscriptionByType[type.name];

        if (subscribe) {
          const typeSubscriptionManager = childCache.managerForType(
            info,
            manager,
            (newValue) => {
              update(newValue);
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
    const cache = new SubscriptionCache();

    return {
      onSubscribe: (value: unknown) => {
        if (value instanceof SubscriptionManager) {
          // eslint-disable-next-line no-param-reassign
          requestData.manager = value;
        }
      },
      onValue: (value: unknown): ParentData | null => {
        if (requestData.manager) {
          return {
            cache,
            refetch: () => {
              cache.delete(info);
            },
          };
        }

        return null;
      },
    };
  }
}
