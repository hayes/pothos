import { MaybePromise, Merge, SchemaTypes } from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ScopeAuthPluginOptions {}

export interface BuiltInScopes<Types extends SchemaTypes> {
  $all?: true extends true ? AuthScopeMap<Types> : never;
  $any?: true extends true ? AuthScopeMap<Types> : never;
  $granted?: string[];
}

export type AuthScopeMap<Types extends SchemaTypes> = Merge<
  Partial<Types['AuthScopes']> & BuiltInScopes<Types>
>;

export type ScopeAuthInitializer<Types extends SchemaTypes> = (
  context: Types['Context'],
) => MaybePromise<
  {
    [K in keyof Types['AuthScopes']]:
      | boolean
      | ((param: Types['AuthScopes'][K]) => MaybePromise<boolean>);
  }
>;

export type TypeAuthScopes<Types extends SchemaTypes, Parent> =
  | AuthScopeMap<Types>
  | ((parent: Parent, context: Types['Context']) => MaybePromise<AuthScopeMap<Types>>);

export type FieldAuthScopes<Types extends SchemaTypes, Parent, Args extends {}> =
  | AuthScopeMap<Types>
  | ((
      parent: Parent,
      args: Args,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<AuthScopeMap<Types> | boolean>);

export type TypeGrantScopes<Types extends SchemaTypes, Parent> = (
  parent: Parent,
  context: Types['Context'],
) => MaybePromise<string[]>;

export type FieldGrantScopes<Types extends SchemaTypes, Parent, Args extends {}> =
  | string[]
  | ((
      parent: Parent,
      args: Args,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<string[]>);
