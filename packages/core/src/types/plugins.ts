import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type { BuildCache } from '../build-cache';
import type { BasePlugin } from '../plugins/plugin';
import type { PothosObjectTypeConfig } from './configs';
import type { SchemaTypes } from './schema-types';
import type { MaybePromise } from './utils';

/**
 * @deprecated This will be replaced by by wrapResolve, wrapSubscribe, and wrapResolveType
 */
export interface ResolveHooks<Types extends SchemaTypes, T> {
  overwriteResolve?: (
    parent: unknown,
    args: {},
    context: Types['Context'],
    info: GraphQLResolveInfo,
    originalResolver: GraphQLFieldResolver<unknown, Types['Context']>,
  ) => unknown;
  onResolve?: (value: unknown) => MaybePromise<void>;
  onChild?: (
    child: unknown,
    index: number | null,
    type: PothosObjectTypeConfig,
    update: (value: unknown) => void,
  ) => MaybePromise<T | null>;
  onWrappedResolve?: (wrapped: unknown) => MaybePromise<void>;
}

/**
 * @deprecated This will be replaced by by wrapResolve, wrapSubscribe, and wrapResolveType
 */
export interface SubscribeHooks<Types extends SchemaTypes, T> {
  overwriteSubscribe?: (
    parent: unknown,
    args: {},
    context: Types['Context'],
    info: GraphQLResolveInfo,
    originalResolver: GraphQLFieldResolver<unknown, Types['Context']>,
  ) => unknown;
  onSubscribe?: (value: unknown) => MaybePromise<void>;
  onValue?: (child: unknown) => MaybePromise<T | null>;
}

export type PluginConstructorMap<Types extends SchemaTypes> = {
  [K in keyof PothosSchemaTypes.Plugins<SchemaTypes>]: new (
    buildCache: BuildCache<SchemaTypes>,
    name: K,
  ) => BasePlugin<Types> & PothosSchemaTypes.Plugins<Types>[K];
};

export type PluginMap<Types extends SchemaTypes> = {
  [K in keyof PluginConstructorMap<Types>]: InstanceType<PluginConstructorMap<Types>[K]>;
};

export type PluginName = keyof PluginConstructorMap<SchemaTypes>;
