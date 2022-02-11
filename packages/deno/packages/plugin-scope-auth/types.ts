// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { FieldNullability, InputFieldMap, InputShapeFromFields, MaybePromise, Merge, SchemaTypes, ShapeFromTypeParam, TypeParam, } from '../core/index.ts';
import ResolveState from './resolve-state.ts';
export interface ScopeAuthPluginOptions<Types extends SchemaTypes> {
    unauthorizedError?: UnauthorizedErrorFn<Types, unknown, {}>;
    cacheKey?: (value: unknown) => unknown;
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
export enum AuthScopeFailureType {
    AuthScope = "AuthScope",
    AuthScopeFunction = "AuthScopeFunction",
    GrantedScope = "GrantedScope",
    AnyAuthScopes = "AnyAuthScopes",
    AllAuthScopes = "AllAuthScopes",
    Unknown = "Unknown"
}
export interface AuthScopeFailure {
    kind: AuthScopeFailureType.AuthScope;
    scope: string;
    parameter: unknown;
}
export interface AuthScopeFunctionFailure {
    kind: AuthScopeFailureType.AuthScopeFunction;
}
export interface UnknownAuthFailure {
    kind: AuthScopeFailureType.Unknown;
}
export interface AnyAuthScopesFailure {
    kind: AuthScopeFailureType.AnyAuthScopes;
    failures: AuthFailure[];
}
export interface AllAuthScopesFailure {
    kind: AuthScopeFailureType.AllAuthScopes;
    failures: AuthFailure[];
}
export interface GrantedScopeFailure {
    kind: AuthScopeFailureType.GrantedScope;
    scope: string;
}
export type AuthFailure = AuthScopeFailure | AuthScopeFunctionFailure | GrantedScopeFailure | AnyAuthScopesFailure | AllAuthScopesFailure | UnknownAuthFailure;
export interface ForbiddenResult {
    message: string;
    failure: AuthFailure;
}
export interface ResolveStep<Types extends SchemaTypes> {
    run: (state: ResolveState<Types>, parent: unknown, args: Record<string, unknown>, context: {}, info: GraphQLResolveInfo) => MaybePromise<null | AuthFailure>;
    errorMessage: string | ((parent: unknown, args: Record<string, unknown>, context: {}, info: GraphQLResolveInfo) => string);
}
export type ContextForAuth<Types extends SchemaTypes, Scopes extends {}> = keyof Scopes & keyof Types["AuthContexts"] extends string ? Types["AuthContexts"][keyof Scopes & keyof Types["AuthContexts"]] : Types["Context"];
export type UnauthorizedResolver<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap> = (parent: ParentShape, args: InputShapeFromFields<Args>, context: Types["Context"], info: GraphQLResolveInfo, error: Error) => MaybePromise<ShapeFromTypeParam<Types, Type, Nullable>>;
export type UnauthorizedErrorFn<Types extends SchemaTypes, ParentShape, Args extends InputFieldMap> = (parent: ParentShape, args: InputShapeFromFields<Args>, context: Types["Context"], info: GraphQLResolveInfo, result: ForbiddenResult) => Error | string;
export interface UnauthorizedOptions<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap> {
    unauthorizedError?: UnauthorizedErrorFn<Types, ParentShape, Args>;
    unauthorizedResolver?: UnauthorizedResolver<Types, ParentShape, Type, Nullable, Args>;
}
