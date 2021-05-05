// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { MaybePromise, Merge, SchemaTypes } from '../core/index.ts';
import ResolveState from './resolve-state.ts';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ScopeAuthPluginOptions {
}
export interface BuiltInScopes<Types extends SchemaTypes> {
    $all?: true extends true ? AuthScopeMap<Types> : never;
    $any?: true extends true ? AuthScopeMap<Types> : never;
    $granted?: string;
}
export type AuthScopeMap<Types extends SchemaTypes> = Merge<BuiltInScopes<Types> & Partial<Types["AuthScopes"]>>;
export type ScopeLoaderMap<Types extends SchemaTypes> = {
    [K in keyof Types["AuthScopes"]]: boolean | ((param: Types["AuthScopes"][K]) => MaybePromise<boolean>);
};
export type ScopeAuthInitializer<Types extends SchemaTypes> = (context: Types["Context"]) => MaybePromise<ScopeLoaderMap<Types>>;
export type TypeAuthScopesFunction<Types extends SchemaTypes, Parent> = (parent: Parent, context: Types["Context"]) => MaybePromise<AuthScopeMap<Types> | boolean>;
export type TypeAuthScopes<Types extends SchemaTypes, Parent> = AuthScopeMap<Types> | TypeAuthScopesFunction<Types, Parent>;
export type FieldAuthScopes<Types extends SchemaTypes, Parent, Args extends {}> = AuthScopeMap<Types> | ((parent: Parent, args: Args, context: Types["Context"], info: GraphQLResolveInfo) => MaybePromise<AuthScopeMap<Types> | boolean>);
export type TypeGrantScopes<Types extends SchemaTypes, Parent> = (parent: Parent, context: Types["Context"]) => MaybePromise<string[]>;
export type FieldGrantScopes<Types extends SchemaTypes, Parent, Args extends {}> = string[] | ((parent: Parent, args: Args, context: Types["Context"], info: GraphQLResolveInfo) => MaybePromise<string[]>);
export interface ResolveStep<Types extends SchemaTypes> {
    run: (state: ResolveState<Types>, parent: unknown, args: Record<string, unknown>, context: {}, info: GraphQLResolveInfo) => MaybePromise<boolean>;
    errorMessage: string | ((parent: unknown, args: Record<string, unknown>, context: {}, info: GraphQLResolveInfo) => string);
}
