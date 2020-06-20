/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TypeParam,
  InputFieldMap,
  FieldNullability,
  RootName,
  InputShapeFromFields,
  SchemaTypes,
  ObjectParam,
} from '@giraphql/core';
import {
  PermissionCheckMap,
  PreResolveCheck,
  PermissionCheck,
  GrantPermissions,
  PostResolveCheck,
  PermissionMatcher,
  UnionPostResolveCheck,
  InterfacePostResolveCheck,
  AuthFieldData,
} from './types';
import { AuthMeta } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface FieldWrapData {
      giraphqlAuth: AuthFieldData;
    }

    export interface ResolverPluginData {
      giraphqlAuth?: AuthMeta;
    }

    export interface RootTypeOptions<Types extends SchemaTypes, Type extends RootName> {
      permissions?: PermissionCheckMap<Types, Types['Root']>;
      defaultPermissionCheck?: string | string[] | PermissionMatcher;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      preResolveCheck?: PreResolveCheck<Types>;
      postResolveCheck?: PostResolveCheck<Types, Shape>;
      permissions?: PermissionCheckMap<Types, Shape>;
      defaultPermissionCheck?: string | string[] | PermissionMatcher;
    }

    export interface InterfaceTypeOptions<Types extends SchemaTypes, Shape> {
      preResolveCheck?: PreResolveCheck<Types>;
      postResolveCheck?: InterfacePostResolveCheck<Types, Shape>;
      permissionChecks?: PermissionCheckMap<Types, Shape>;
      defaultPermissionCheck?: string | string[] | PermissionMatcher;
      skipImplementorPreResolveChecks?: boolean;
    }

    export interface UnionTypeOptions<
      Types extends SchemaTypes,
      Member extends ObjectParam<Types>
    > {
      preResolveCheck?: PreResolveCheck<Types>;
      postResolveCheck?: UnionPostResolveCheck<Types, Member>;
      skipMemberPreResolveChecks?: boolean;
    }

    export interface FieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape
    > {
      permissionCheck?: PermissionCheck<Types, ParentShape, InputShapeFromFields<Args>>;
      grantPermissions?: GrantPermissions<Types, ParentShape, InputShapeFromFields<Args>>;
    }

    export interface InterfaceFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape
    >
      extends FieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ParentShape,
        ResolveReturnShape
      > {
      permissionCheck?: PermissionCheck<Types, ParentShape, InputShapeFromFields<Args>>;
      grantPermissions?: GrantPermissions<Types, ParentShape, InputShapeFromFields<Args>>;
    }

    export interface SubscriptionFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape
    >
      extends FieldOptions<
        Types,
        Types['Root'],
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      > {
      permissionCheck?: PermissionCheck<Types, Types['Root'], InputShapeFromFields<Args>>;
      grantPermissions?: GrantPermissions<Types, Types['Root'], InputShapeFromFields<Args>>;
    }
  }
}
