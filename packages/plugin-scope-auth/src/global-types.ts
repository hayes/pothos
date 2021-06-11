/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  RootName,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import {
  FieldAuthScopes,
  FieldGrantScopes,
  ScopeAuthInitializer,
  ScopeAuthPluginOptions,
  TypeAuthScopes,
  TypeGrantScopes,
} from './types';
import { GiraphQLScopeAuthPlugin } from '.';

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
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      AuthScopes: undefined extends PartialTypes['AuthScopes']
        ? {}
        : PartialTypes['AuthScopes'] & {};
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
  }
}
