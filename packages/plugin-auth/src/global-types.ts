/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TypeParam,
  InputFields,
  FieldNullability,
  RootName,
  InputShapeFromFields,
} from '@giraphql/core';
import {
  PermissionCheckMap,
  PreResolveCheck,
  PermissionCheck,
  GrantPermissions,
  PostResolveCheck,
  PermissionMatcher,
} from './types';
import AuthMeta from './auth-wrapper';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface FieldWrapData {
      giraphqlAuth: {
        returnTypename: string;
        fieldName: string;
        preResolveCheck?: PreResolveCheck<any>;
        postResolveCheck?: PostResolveCheck<any, unknown>;
        postResolveMap: Map<string, PostResolveCheck<any, unknown> | null>;
        permissionChecksFromType: PermissionCheckMap<any, any>;
        grantPermissions: GrantPermissions<any, any, any> | null;
        permissionCheck: PermissionCheck<any, any, any>;
      };
    }

    export interface ResolverPluginData {
      giraphqlAuth?: AuthMeta;
    }

    export interface RootTypeOptions<Types extends TypeInfo, Type extends RootName> {
      permissions?: PermissionCheckMap<Types, Types['Root']>;
      defaultPermissionCheck?: string | string[] | PermissionMatcher;
    }

    export interface ObjectTypeOptions<Types extends TypeInfo, Shape> {
      preResolveCheck?: PreResolveCheck<Types>;
      postResolveCheck?: PostResolveCheck<Types, Shape>;
      permissions?: PermissionCheckMap<Types, Shape>;
      defaultPermissionCheck?: string | string[] | PermissionMatcher;
    }

    export interface InterfaceTypeOptions<Types extends TypeInfo, Shape> {
      permissionChecks?: PermissionCheckMap<Types, Shape>;
      defaultPermissionCheck?: string | string[] | PermissionMatcher;
    }

    export interface FieldOptions<
      Types extends TypeInfo,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>,
      ResolveShape
    > {
      permissionCheck?: PermissionCheck<Types, ParentShape, InputShapeFromFields<Types, Args>>;
      grantPermissions?: GrantPermissions<Types, ParentShape, InputShapeFromFields<Types, Args>>;
    }

    export interface InterfaceFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentShape, Type, Nullable, Args, ParentShape> {
      permissionCheck?: PermissionCheck<Types, ParentShape, InputShapeFromFields<Types, Args>>;
      grantPermissions?: GrantPermissions<Types, ParentShape, InputShapeFromFields<Types, Args>>;
    }

    export interface SubscriptionFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>,
      ResolveShape
    > extends FieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveShape> {
      permissionCheck?: PermissionCheck<Types, ParentShape, InputShapeFromFields<Types, Args>>;
      grantPermissions?: GrantPermissions<Types, ParentShape, InputShapeFromFields<Types, Args>>;
    }
  }
}
