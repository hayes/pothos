import { GraphQLResolveInfo, GraphQLFieldResolver } from 'graphql';
import { SchemaTypes, MaybePromise, GiraphQLObjectTypeConfig } from '..';
import { BasePlugin } from '../plugins';

export interface ResolveHooks<Types extends SchemaTypes, T> {
  overwriteResolve?(
    parent: unknown,
    args: {},
    context: Types['Context'],
    info: GraphQLResolveInfo,
    originalResolver: GraphQLFieldResolver<unknown, Types['Context']>,
  ): unknown;
  onResolve?(value: unknown): MaybePromise<void>;
  onChild?(
    child: unknown,
    index: number | null,
    type: GiraphQLObjectTypeConfig,
    update: (value: unknown) => void,
  ): MaybePromise<T | null>;
  onWrappedResolve?(wrapped: unknown): MaybePromise<void>;
}

export interface SubscribeHooks<Types extends SchemaTypes, T> {
  overwriteSubscribe?(
    parent: unknown,
    args: {},
    context: Types['Context'],
    info: GraphQLResolveInfo,
    originalResolver: GraphQLFieldResolver<unknown, Types['Context']>,
  ): unknown;
  onSubscribe?(value: unknown): MaybePromise<void>;
  onValue?(child: unknown): MaybePromise<T | null>;
}

export type PluginConstructorMap<Types extends SchemaTypes> = {
  [K in keyof GiraphQLSchemaTypes.Plugins<SchemaTypes>]: {
    new (
      builder: GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
      name: K,
    ): GiraphQLSchemaTypes.Plugins<Types>[K] & BasePlugin<Types>;
  };
};

export type PluginMap<Types extends SchemaTypes> = {
  [K in keyof PluginConstructorMap<Types>]: InstanceType<PluginConstructorMap<Types>[K]>;
};

export type PluginName = keyof PluginConstructorMap<SchemaTypes>;
