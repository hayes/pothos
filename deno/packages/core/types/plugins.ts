import { GraphQLFieldResolver, GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql@v15.5.0?dts';
import { BasePlugin } from '../plugins/index.ts';
import { BuildCache, GiraphQLObjectTypeConfig, MaybePromise, SchemaTypes } from '../index.ts';
/**
 * @deprecated This will be replaced by by wrapResolve, wrapSubscribe, and wrapResolveType
 */
export interface ResolveHooks<Types extends SchemaTypes, T> {
    overwriteResolve?: (parent: unknown, args: {}, context: Types["Context"], info: GraphQLResolveInfo, originalResolver: GraphQLFieldResolver<unknown, Types["Context"]>) => unknown;
    onResolve?: (value: unknown) => MaybePromise<void>;
    onChild?: (child: unknown, index: number | null, type: GiraphQLObjectTypeConfig, update: (value: unknown) => void) => MaybePromise<T | null>;
    onWrappedResolve?: (wrapped: unknown) => MaybePromise<void>;
}
/**
 * @deprecated This will be replaced by by wrapResolve, wrapSubscribe, and wrapResolveType
 */
export interface SubscribeHooks<Types extends SchemaTypes, T> {
    overwriteSubscribe?: (parent: unknown, args: {}, context: Types["Context"], info: GraphQLResolveInfo, originalResolver: GraphQLFieldResolver<unknown, Types["Context"]>) => unknown;
    onSubscribe?: (value: unknown) => MaybePromise<void>;
    onValue?: (child: unknown) => MaybePromise<T | null>;
}
export type PluginConstructorMap<Types extends SchemaTypes> = {
    [K in keyof GiraphQLSchemaTypes.Plugins<SchemaTypes>]: new (buildCache: BuildCache<SchemaTypes>, name: K) => BasePlugin<Types> & GiraphQLSchemaTypes.Plugins<Types>[K];
};
export type PluginMap<Types extends SchemaTypes> = {
    [K in keyof PluginConstructorMap<Types>]: InstanceType<PluginConstructorMap<Types>[K]>;
};
export type PluginName = keyof PluginConstructorMap<SchemaTypes>;
