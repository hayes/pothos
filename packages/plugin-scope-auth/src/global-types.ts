/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  FieldRef,
  InputFieldMap,
  InputShapeFromFields,
  MaybePromise,
  Normalize,
  Resolver,
  RootName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type {
  AuthScopeMap,
  ContextForAuth,
  FieldAuthScopes,
  FieldGrantScopes,
  ForbiddenResult,
  ReplaceContext,
  ScopeAuthInitializer,
  ScopeAuthPluginOptions,
  TypeAuthScopes,
  TypeGrantScopes,
  UnauthorizedOptions,
} from './types';

import type { PothosScopeAuthPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      scopeAuth: PothosScopeAuthPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      scopeAuth: ScopeAuthPluginOptions<Types>;
    }

    export interface V3SchemaBuilderOptions<Types extends SchemaTypes> {
      scopeAuth: never;
      scopeAuthOptions?: Omit<ScopeAuthPluginOptions<Types>, 'authScopes'>;
      authScopes: ScopeAuthInitializer<Types>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      runAuthScopes: (
        context: Types['Context'],
        scopes: AuthScopeMap<Types>,
        unauthorizedError?: (result: ForbiddenResult) => Error | string,
      ) => MaybePromise<void>;
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      disableScopeAuth?: boolean;
    }

    export interface UserSchemaTypes {
      AuthScopes: {};
      AuthContexts: {};
      DefaultAuthStrategy: 'all' | 'any';
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      AuthScopes: PartialTypes['AuthScopes'] & {};
      AuthContexts: PartialTypes['AuthContexts'] & {};
      DefaultAuthStrategy: undefined extends PartialTypes['DefaultAuthStrategy']
        ? 'any'
        : PartialTypes['DefaultAuthStrategy'] & string;
    }

    export interface RootTypeOptions<Types extends SchemaTypes, Type extends RootName> {
      authScopes?: TypeAuthScopes<Types, Types['Root']>;
      grantScopes?: TypeGrantScopes<Types, Types['Root']>;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      authScopes?: TypeAuthScopes<Types, Shape>;
      grantScopes?: TypeGrantScopes<Types, Shape>;
      runScopesOnType?: boolean;
      skipInterfaceScopes?: boolean;
    }

    export interface InterfaceTypeOptions<Types extends SchemaTypes, Shape> {
      authScopes?: TypeAuthScopes<Types, Shape>;
      grantScopes?: TypeGrantScopes<Types, Shape>;
      runScopesOnType?: boolean;
    }

    export interface FieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > extends UnauthorizedOptions<Types, ParentShape, Type, Nullable, Args> {
      authScopes?: FieldAuthScopes<Types, ParentShape, InputShapeFromFields<Args>>;
      grantScopes?: FieldGrantScopes<Types, ParentShape, InputShapeFromFields<Args>>;
      skipTypeScopes?: boolean;
    }

    export interface ObjectFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ParentShape,
        ResolveReturnShape
      > {
      skipInterfaceScopes?: boolean;
    }

    export interface InterfaceFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ParentShape,
        ResolveReturnShape
      > {
      skipInterfaceScopes?: boolean;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      authField: <
        Args extends InputFieldMap,
        Type extends TypeParam<Types>,
        Scopes extends FieldAuthScopes<Types, ParentShape, InputShapeFromFields<Args>>,
        ResolveShape,
        ResolveReturnShape,
        Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
      >(
        options: Normalize<
          Omit<
            FieldOptionsFromKind<
              Types,
              ParentShape,
              Type,
              Nullable,
              Args,
              Kind,
              ResolveShape,
              ResolveReturnShape
            >,
            'resolve'
          > & {
            authScopes: Scopes;
            resolve: Resolver<
              Types['Root'],
              InputShapeFromFields<Args>,
              ContextForAuth<Types, Scopes>,
              ShapeFromTypeParam<Types, Type, Nullable>,
              ResolveReturnShape
            >;
          }
        >,
      ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, Kind>;
    }

    export interface QueryFieldBuilder<Types extends SchemaTypes, ParentShape> {
      withAuth: <Scopes extends FieldAuthScopes<Types, ParentShape, Record<string, unknown>>>(
        scopes: Scopes,
      ) => QueryFieldBuilder<
        ReplaceContext<Types, ContextForAuth<Types, Scopes> & object>,
        ParentShape
      >;
    }

    export interface MutationFieldBuilder<Types extends SchemaTypes, ParentShape> {
      withAuth: <Scopes extends FieldAuthScopes<Types, ParentShape, Record<string, unknown>>>(
        scopes: Scopes,
      ) => MutationFieldBuilder<
        ReplaceContext<Types, ContextForAuth<Types, Scopes> & object>,
        ParentShape
      >;
    }

    export interface SubscriptionFieldBuilder<Types extends SchemaTypes, ParentShape> {
      withAuth: <Scopes extends FieldAuthScopes<Types, ParentShape, Record<string, unknown>>>(
        scopes: Scopes,
      ) => SubscriptionFieldBuilder<
        ReplaceContext<Types, ContextForAuth<Types, Scopes> & object>,
        ParentShape
      >;
    }

    export interface ObjectFieldBuilder<Types extends SchemaTypes, ParentShape> {
      withAuth: <Scopes extends FieldAuthScopes<Types, ParentShape, Record<string, unknown>>>(
        scopes: Scopes,
      ) => ObjectFieldBuilder<
        ReplaceContext<Types, ContextForAuth<Types, Scopes> & object>,
        ParentShape
      >;
    }

    export interface InterfaceFieldBuilder<Types extends SchemaTypes, ParentShape> {
      withAuth: <Scopes extends FieldAuthScopes<Types, ParentShape, Record<string, unknown>>>(
        scopes: Scopes,
      ) => InterfaceFieldBuilder<
        ReplaceContext<Types, ContextForAuth<Types, Scopes> & object>,
        ParentShape
      >;
    }

    export interface ScopeAuthFieldAuthScopes<
      Types extends SchemaTypes,
      Parent,
      Args extends {} = {},
    > {
      Scopes: FieldAuthScopes<Types, Parent, Args>;
    }
    export interface ScopeAuthContextForAuth<Types extends SchemaTypes, Scopes extends {}> {
      Context: ContextForAuth<Types, Scopes>;
    }
  }
}
