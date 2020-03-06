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
  UnionPostResolveCheck,
  InterfacePostResolveCheck,
} from './types';
import AuthMeta from './auth-wrapper';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface FieldWrapData {
      giraphqlAuth: {
        returnTypename: string;
        fieldName: string;
        preResolveCheckMap?: Map<string, PreResolveCheck<any>>;
        postResolveMap: Map<string, PostResolveCheck<any, unknown> | null>;
        postResolveCheck?: PostResolveCheck<any, unknown>;
        postResolveUnionCheck?: UnionPostResolveCheck<any, any>;
        postResolveInterfaceCheck?: InterfacePostResolveCheck<any, unknown>;
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
      preResolveCheck?: PreResolveCheck<Types>;
      postResolveCheck?: InterfacePostResolveCheck<Types, Shape>;
      permissionChecks?: PermissionCheckMap<Types, Shape>;
      defaultPermissionCheck?: string | string[] | PermissionMatcher;
      skipImplementorPreResolveChecks?: boolean;
    }

    export interface UnionOptions<Types extends TypeInfo, Member extends keyof Types['Object']> {
      preResolveCheck?: PreResolveCheck<Types>;
      postResolveCheck?: UnionPostResolveCheck<Types, Member>;
      skipMemberPreResolveChecks?: boolean;
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
