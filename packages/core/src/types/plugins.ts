import { GraphQLResolveInfo, GraphQLFieldResolver } from 'graphql';
import { SchemaTypes, MaybePromise, GiraphQLObjectTypeConfig } from '..';

export interface ResolveHooks<Types extends SchemaTypes, T> {
  overwriteResolve?: (
    parent: unknown,
    args: {},
    context: Types['Context'],
    info: GraphQLResolveInfo,
    originalResolver: GraphQLFieldResolver<unknown, Types['Context']>,
  ) => unknown;
  onResolve?(value: unknown): MaybePromise<void>;
  onChild?(
    child: unknown,
    index: number | null,
    type: GiraphQLObjectTypeConfig,
    update: (value: unknown) => void,
  ): MaybePromise<T | null>;
  onWrappedResolve?(wrapped: unknown): MaybePromise<void>;
}
