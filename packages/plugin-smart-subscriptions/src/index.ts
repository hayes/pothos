import './global-types';
import { defaultFieldResolver, GraphQLFieldResolver, GraphQLTypeResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  BuildCache,
  FieldRef,
  PothosOutputFieldConfig,
  SchemaTypes,
} from '@pothos/core';
import SubscriptionCache from './cache';
import { getFieldSubscribe } from './create-field-data';
import SubscriptionManager from './manager';
import resolveWithCache from './resolve-with-cache';

const DEFAULT_DEBOUNCE_DELAY = 10;

export * from './types';
export * from './utils';

const pluginName = 'smartSubscriptions';

export default pluginName;
export class PothosSmartSubscriptionsPlugin<Types extends SchemaTypes> extends BasePlugin<
  Types,
  {
    cache?: SubscriptionCache<Types>;
  }
> {
  debounceDelay: number | null;

  smartSubscriptionsToQueryField = new Map<
    string,
    Extract<PothosOutputFieldConfig<Types>, { kind: 'Query' }>
  >();

  subscribe: (
    name: string,
    context: Types['Context'],
    cb: (err: unknown, data: unknown) => void,
  ) => Promise<void> | void;

  unsubscribe: (name: string, context: Types['Context']) => Promise<void> | void;

  constructor(buildCache: BuildCache<Types>) {
    super(buildCache, pluginName);

    this.subscribe = this.builder.options.smartSubscriptions.subscribe;
    this.unsubscribe = this.builder.options.smartSubscriptions.unsubscribe;
    this.debounceDelay =
      this.builder.options.smartSubscriptions.debounceDelay === null
        ? null
        : DEFAULT_DEBOUNCE_DELAY;
  }

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (fieldConfig.kind === 'Query' && fieldConfig.pothosOptions.smartSubscription) {
      this.smartSubscriptionsToQueryField.set(fieldConfig.name, fieldConfig);

      this.builder.subscriptionField(
        fieldConfig.name,
        (t) =>
          t.field({
            ...fieldConfig.pothosOptions,
            resolve: (parent, args, context, info) =>
              (fieldConfig.resolve ?? defaultFieldResolver)(parent, args, context, info) as never,
            subscribe: (parent, args, context, info) => {
              const manager = new SubscriptionManager({
                value: parent,
                debounceDelay: this.debounceDelay,
                subscribe: (subName, cb) => this.subscribe(subName, context, cb),
                unsubscribe: (subName) => this.unsubscribe(subName, context),
              });

              const cache = new SubscriptionCache(manager, this.buildCache);

              this.requestData(context).cache = cache;

              return {
                [Symbol.asyncIterator]() {
                  return {
                    async next() {
                      return manager.next().then((next) => {
                        cache.next();

                        return next;
                      });
                    },
                    async return() {
                      return manager.return();
                    },
                    async throw(error: unknown) {
                      return manager.throw(error);
                    },
                  };
                },
              };
            },
          }) as FieldRef<Types, unknown>,
      );
    }

    return fieldConfig;
  }

  override createRequestData(context: Types['Context']) {
    return {};
  }

  override wrapResolve(
    resolve: GraphQLFieldResolver<unknown, Types['Context']>,
    field: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context']> {
    let canRefetch = false;
    if (
      field.graphqlKind === 'Object' &&
      field.kind !== 'Query' &&
      field.kind !== 'Subscription' &&
      field.kind !== 'Mutation'
    ) {
      canRefetch = field.pothosOptions.canRefetch ?? false;
    }

    const subscribe = getFieldSubscribe(field, this);

    return (parent, args, context, info) => {
      const { cache } = this.requestData(context);

      if (!cache) {
        return resolve(parent, args, context, info);
      }

      return resolveWithCache(
        cache,
        subscribe,
        resolve,
        canRefetch,
        parent,
        args as {},
        context,
        info,
      );
    };
  }

  override wrapResolveType(resolveType: GraphQLTypeResolver<unknown, Types['Context']>) {
    return resolveType;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosSmartSubscriptionsPlugin);

export { default as SubscriptionCache } from './cache';
export { default as CacheNode } from './cache-node';
export { default as SubscriptionManager } from './manager';
export { default as BaseSubscriptionManager } from './manager/base';
export { default as FieldSubscriptionManager } from './manager/field';
export { default as TypeSubscriptionManager } from './manager/type';
