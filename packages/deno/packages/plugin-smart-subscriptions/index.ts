// @ts-nocheck
import './global-types.ts';
import { defaultFieldResolver, GraphQLFieldResolver, GraphQLTypeResolver } from 'https://cdn.skypack.dev/graphql?dts';
import SchemaBuilder, { BasePlugin, BuildCache, FieldRef, GiraphQLOutputFieldConfig, SchemaTypes, } from '../core/index.ts';
import SubscriptionCache from './cache.ts';
import CacheNode from './cache-node.ts';
import { getFieldSubscribe } from './create-field-data.ts';
import SubscriptionManager from './manager/index.ts';
import BaseSubscriptionManager from './manager/base.ts';
import FieldSubscriptionManager from './manager/field.ts';
import TypeSubscriptionManager from './manager/type.ts';
import resolveWithCache from './resolve-with-cache.ts';
const DEFAULT_DEBOUNCE_DELAY = 10;
export { BaseSubscriptionManager, CacheNode, FieldSubscriptionManager, SubscriptionCache, SubscriptionManager, TypeSubscriptionManager, };
export * from './types.ts';
export * from './utils.ts';
const pluginName = "smartSubscriptions" as const;
export default pluginName;
export class GiraphQLSmartSubscriptionsPlugin<Types extends SchemaTypes> extends BasePlugin<Types, {
    cache?: SubscriptionCache<Types>;
}> {
    debounceDelay: number | null;
    smartSubscriptionsToQueryField = new Map<string, Extract<GiraphQLOutputFieldConfig<Types>, {
        kind: "Query";
    }>>();
    subscribe: (name: string, context: Types["Context"], cb: (err: unknown, data: unknown) => void) => Promise<void> | void;
    unsubscribe: (name: string, context: Types["Context"]) => Promise<void> | void;
    constructor(buildCache: BuildCache<Types>) {
        super(buildCache, pluginName);
        this.subscribe = this.builder.options.smartSubscriptions.subscribe;
        this.unsubscribe = this.builder.options.smartSubscriptions.unsubscribe;
        this.debounceDelay =
            this.builder.options.smartSubscriptions.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
    }
    onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
        if (fieldConfig.kind === "Query" && fieldConfig.giraphqlOptions.smartSubscription) {
            this.smartSubscriptionsToQueryField.set(fieldConfig.name, fieldConfig);
            this.builder.subscriptionField(fieldConfig.name, (t) => t.field({
                ...fieldConfig.giraphqlOptions,
                resolve: (parent, args, context, info) => 
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                (fieldConfig.resolve ?? defaultFieldResolver)(parent, args, context, info),
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
            }) as FieldRef<unknown>);
        }
        return fieldConfig;
    }
    createRequestData(context: Types["Context"]) {
        return {};
    }
    wrapResolve(resolve: GraphQLFieldResolver<unknown, Types["Context"]>, field: GiraphQLOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"]> {
        let canRefetch = false;
        if (field.graphqlKind === "Object" &&
            field.kind !== "Query" &&
            field.kind !== "Subscription" &&
            field.kind !== "Mutation") {
            canRefetch = field.giraphqlOptions.canRefetch ?? false;
        }
        const subscribe = getFieldSubscribe(field, this);
        return (parent, args, context, info) => {
            const { cache } = this.requestData(context);
            if (!cache) {
                return resolve(parent, args, context, info) as unknown;
            }
            return resolveWithCache(cache, subscribe, resolve, canRefetch, parent, args, context, info);
        };
    }
    wrapResolveType(resolveType: GraphQLTypeResolver<unknown, Types["Context"]>) {
        return resolveType;
    }
}
SchemaBuilder.registerPlugin(pluginName, GiraphQLSmartSubscriptionsPlugin);
