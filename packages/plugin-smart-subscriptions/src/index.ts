import { defaultFieldResolver, GraphQLFieldResolver, GraphQLTypeResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  SchemaTypes,
  GiraphQLOutputFieldConfig,
  ValueWrapper,
  FieldRef,
  BuildCache,
} from '@giraphql/core';
import './global-types';

import SubscriptionManager from './manager';
import FieldSubscriptionManager from './manager/field';
import TypeSubscriptionManager from './manager/type';
import BaseSubscriptionManager from './manager/base';
import { getFieldSubscribe } from './create-field-data';
import SubscriptionCache from './cache';
import CacheNode from './cache-node';
import resolveWithCache from './resolve-with-cache';

const DEFAULT_DEBOUNCE_DELAY = 10;

export {
  SubscriptionManager,
  BaseSubscriptionManager,
  TypeSubscriptionManager,
  FieldSubscriptionManager,
  SubscriptionCache,
  CacheNode,
};

export * from './types';
export * from './utils';

export default class SmartSubscriptionsPlugin<Types extends SchemaTypes> extends BasePlugin<
  Types,
  {
    cache?: SubscriptionCache<Types>;
  }
> {
  debounceDelay: number | null;

  smartSubscriptionsToQueryField = new Map<
    string,
    Extract<GiraphQLOutputFieldConfig<Types>, { kind: 'Query' }>
  >();

  subscribe: (
    name: string,
    context: Types['Context'],
    cb: (err: unknown, data: unknown) => void,
  ) => Promise<void> | void;

  unsubscribe: (name: string, context: Types['Context']) => Promise<void> | void;

  constructor(buildCache: BuildCache<Types>, name: 'GiraphQLSmartSubscriptions') {
    super(buildCache, name);

    this.subscribe = this.builder.options.smartSubscriptions.subscribe;
    this.unsubscribe = this.builder.options.smartSubscriptions.unsubscribe;
    this.debounceDelay =
      this.builder.options.smartSubscriptions.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
  }

  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    if (fieldConfig.kind !== 'Query') {
      return;
    }

    if (fieldConfig.giraphqlOptions.smartSubscription) {
      this.smartSubscriptionsToQueryField.set(fieldConfig.name, fieldConfig);

      this.builder.subscriptionField(
        fieldConfig.name,
        (t) =>
          t.field({
            ...fieldConfig.giraphqlOptions,
            resolve: (parent, args, context, info) => {
              this.requestData(context).cache!.next();

              return (fieldConfig.resolve || defaultFieldResolver)(parent, args, context, info);
            },
            subscribe: (parent, args, context, info) => {
              const manager = new SubscriptionManager({
                value: new ValueWrapper(parent, {}),
                debounceDelay: this.debounceDelay,
                subscribe: (subName, cb) => this.subscribe(subName, context, cb),
                unsubscribe: (subName) => this.unsubscribe(subName, context),
              });

              const cache = new SubscriptionCache(manager, this.builder);

              this.requestData(context).cache = cache;

              return manager;
            },
          }) as FieldRef<unknown>,
      );
    }
  }

  createRequestData(context: Types['Context']) {
    return {};
  }

  wrapResolve(
    resolve: GraphQLFieldResolver<unknown, Types['Context']>,
    field: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context']> {
    let canRefetch = false;
    if (
      field.graphqlKind === 'Object' &&
      field.kind !== 'Query' &&
      field.kind !== 'Subscription' &&
      field.kind !== 'Mutation'
    ) {
      canRefetch = field.giraphqlOptions.canRefetch ?? false;
    }

    const subscribe = getFieldSubscribe(field, this);

    return (parent, args, context, info) => {
      const { cache } = this.requestData(context);

      if (!cache) {
        return resolve(parent, args, context, info);
      }

      return resolveWithCache(cache, subscribe, resolve, canRefetch, parent, args, context, info);
    };
  }

  wrapResolveType(resolveType: GraphQLTypeResolver<unknown, Types['Context']>) {
    return resolveType;
  }
}

SchemaBuilder.registerPlugin('GiraphQLSmartSubscriptions', SmartSubscriptionsPlugin);
