/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  FieldRef,
  InputFieldMap,
  InputShapeFromFields,
  Normalize,
  Resolver,
  RootName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@giraphql/core';
import { ContextForAuth, GiraphQLScopeAuthPlugin } from './index.js';
import {
  FieldAuthScopes,
  FieldGrantScopes,
  ScopeAuthInitializer,
  ScopeAuthPluginOptions,
  TypeAuthScopes,
  TypeGrantScopes,
} from './types.js';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      scopeAuth: GiraphQLScopeAuthPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      scopeAuthOptions?: ScopeAuthPluginOptions;
      authScopes: ScopeAuthInitializer<Types>;
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      disableScopeAuth?: boolean;
    }

    export interface UserSchemaTypes {
      AuthScopes: {};
      AuthContexts: {};
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      AuthScopes: undefined extends PartialTypes['AuthScopes']
        ? {}
        : PartialTypes['AuthScopes'] & {};
      AuthContexts: undefined extends PartialTypes['AuthContexts']
        ? {}
        : PartialTypes['AuthContexts'] & {};
    }

    export interface RootTypeOptions<Types extends SchemaTypes, Type extends RootName> {
      authScopes?: TypeAuthScopes<Types, Types['Root']>;
      grantScopes?: TypeGrantScopes<Types, Types['Root']>;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      authScopes?: TypeAuthScopes<Types, Shape>;
      grantScopes?: TypeGrantScopes<Types, Shape>;
    }

    export interface InterfaceTypeOptions<Types extends SchemaTypes, Shape> {
      authScopes?: TypeAuthScopes<Types, Shape>;
      grantScopes?: TypeGrantScopes<Types, Shape>;
    }

    export interface FieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
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
      ) => FieldRef<ShapeFromTypeParam<Types, Type, Nullable>, Kind>;
    }
  }
}
