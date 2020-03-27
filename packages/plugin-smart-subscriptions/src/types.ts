import { GraphQLFieldResolver } from 'graphql';
import { MaybePromise } from '@giraphql/core';

export interface SmartSubscriptionOptions<Context extends object> {
  subscribe: (name: string, context: Context) => AsyncIterator<unknown>;
}

export type WrappedResolver<Context = object> = GraphQLFieldResolver<unknown, Context> & {
  unwrap: () => GraphQLFieldResolver<unknown, Context>;
};

export type RefetchFunction<T, ParentShape> = (val: T) => ParentShape;
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
