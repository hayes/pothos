import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import { MaybePromise, SchemaTypes } from '@giraphql/core';
import { FieldSubscriptionManager } from './index.js';
import SubscriptionManager from './manager/index.js';

export interface SmartSubscriptionOptions<Context extends object> {
  debounceDelay?: number | null;
  subscribe: (
    name: string,
    context: Context,
    cb: (err: unknown, data?: unknown) => void,
  ) => Promise<void> | void;
  unsubscribe: (name: string, context: Context) => Promise<void> | void;
}

export type WrappedResolver<Context = object> = GraphQLFieldResolver<unknown, Context> & {
  unwrap: () => GraphQLFieldResolver<unknown, Context>;
};

export type RefetchFunction<T, ParentShape> = (val: T) => MaybePromise<ParentShape>;
export type IteratorFilterFunction<T = unknown> = (val: T) => boolean;
export type IteratorCallback<T = unknown> = (val: T) => MaybePromise<void>;
export type IteratorCacheInvalidator<T = unknown> = (val: T) => void;

export interface RegisterOptions<T = unknown> {
  name: string;
  filter?: IteratorFilterFunction<T>;
  onValue?: IteratorCallback<T>;
}

export interface RegisterFieldSubscriptionOptions<T> {
  filter?: IteratorFilterFunction<T>;
  invalidateCache?: IteratorCacheInvalidator<T>;
}

export interface RegisterTypeSubscriptionOptions<T, ParentShape> {
  refetch?: RefetchFunction<T, ParentShape>;
  filter?: IteratorFilterFunction<T>;
  invalidateCache?: IteratorCacheInvalidator<T>;
}

export interface RequestData {
  manager?: SubscriptionManager;
}

export type FieldSubscriber<Types extends SchemaTypes> = (
  subscriptions: FieldSubscriptionManager<Types>,
  parent: unknown,
  args: {},
  context: object,
  info: GraphQLResolveInfo,
) => void;
