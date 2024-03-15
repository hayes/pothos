// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { FieldNullability, InputFieldMap, InputShapeFromFields, MaybePromise, Merge, SchemaTypes, ShapeFromTypeParam, TypeParam, UnionToIntersection, } from '../core/index.ts';
import type RequestCache from './request-cache.ts';
export interface ScopeAuthPluginOptions<Types extends SchemaTypes> {
    unauthorizedError?: UnauthorizedForTypeErrorFn<Types, {}>;
    cacheKey?: (value: unknown) => unknown;
    runScopesOnType?: boolean;
    treatErrorsAsUnauthorized?: boolean;
    authorizeOnSubscribe?: boolean;
    defaultStrategy?: Types["DefaultAuthStrategy"];
    authScopes: ScopeAuthInitializer<Types>;
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
export type TypeGrantScopes<Types extends SchemaTypes, Parent> = (parent: Parent, context: Types["Context"]) => MaybePromise<readonly string[]>;
export type FieldGrantScopes<Types extends SchemaTypes, Parent, Args extends {}> = string[] | ((parent: Parent, args: Args, context: Types["Context"], info: GraphQLResolveInfo) => MaybePromise<readonly string[]>);
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
    error: Error | null;
}
export interface AuthScopeFunctionFailure {
    kind: AuthScopeFailureType.AuthScopeFunction;
    error: Error | null;
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
export type AuthFailure = AllAuthScopesFailure | AnyAuthScopesFailure | AuthScopeFailure | AuthScopeFunctionFailure | GrantedScopeFailure | UnknownAuthFailure;
export interface ForbiddenResult {
    message: string;
    failure: AuthFailure;
}
export interface ResolveStep<Types extends SchemaTypes> {
    run: (cache: RequestCache<Types>, parent: unknown, args: Record<string, unknown>, context: {}, info: GraphQLResolveInfo, setResolved: (val: unknown) => void) => MaybePromise<AuthFailure | null>;
    errorMessage: string | ((parent: unknown, args: Record<string, unknown>, context: {}, info: GraphQLResolveInfo) => string);
}
export type ContextForAuth<Types extends SchemaTypes, Scopes> = "any" extends Types["DefaultAuthStrategy"] ? ContextForAuthUnion<Types, Scopes> : UnionToIntersection<ContextForAuthUnion<Types, Scopes>>;
type ContextForAuthUnion<Types extends SchemaTypes, Scopes> = Scopes extends (...args: any[]) => infer R ? ContextForAuthUnion<Types, R> : Scopes extends boolean ? Types["Context"] : keyof Scopes extends infer Scope ? Scope extends keyof Types["AuthContexts"] ? Types["AuthContexts"][Scope] : Scope extends "$any" ? ContextForAuthUnion<Types, Scopes[Scope & keyof Scopes]> : Scope extends "$all" ? UnionToIntersection<ContextForAuthUnion<Types, Scopes[Scope & keyof Scopes]>> : Types["Context"] : never;
export type UnauthorizedResolver<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap> = (parent: ParentShape, args: InputShapeFromFields<Args>, context: Types["Context"], info: GraphQLResolveInfo, error: Error) => MaybePromise<ShapeFromTypeParam<Types, Type, Nullable>>;
export type UnauthorizedErrorFn<Types extends SchemaTypes, ParentShape, Args extends InputFieldMap> = (parent: ParentShape, args: InputShapeFromFields<Args>, context: Types["Context"], info: GraphQLResolveInfo, result: ForbiddenResult) => Error | string;
export type UnauthorizedForTypeErrorFn<Types extends SchemaTypes, ParentShape> = (parent: ParentShape, context: Types["Context"], info: GraphQLResolveInfo, result: ForbiddenResult) => Error | string;
export interface UnauthorizedOptions<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap> {
    unauthorizedError?: UnauthorizedErrorFn<Types, ParentShape, Args>;
    unauthorizedResolver?: UnauthorizedResolver<Types, ParentShape, Type, Nullable, Args>;
}
export type ReplaceContext<Types extends SchemaTypes, Context extends object> = Omit<Types, "Context"> & {
    Context: Context;
};
