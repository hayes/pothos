import { MaybePromise } from '@giraphql/core';
import { GrantedPermissions } from './grant-map';

export interface AuthPluginOptions {
  requirePermissionChecks?: boolean;
  explicitMutationChecks?: boolean;
  skipPreResolveOnInterfaces?: boolean;
  skipPreResolveOnUnions?: boolean;
}

export type SharedPermissionCheck<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape> = (
  parent: ParentShape,
  context: Types['Context'],
) => MaybePromise<boolean>;

export type FieldPermissionCheck<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape, Args> = (
  parent: ParentShape,
  args: Args,
  context: Types['Context'],
) => MaybePromise<boolean | string | string[] | PermissionMatcher>;

export type PermissionGrantMap = { [s: string]: boolean | undefined };

export type PreResolveCheck<Types extends GiraphQLSchemaTypes.TypeInfo> = (
  context: Types['Context'],
) => MaybePromise<boolean | PermissionGrantMap>;

export type PostResolveCheck<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = (
  parent: Shape,
  context: Types['Context'],
  grantedPermissions: GrantedPermissions,
) => MaybePromise<boolean | PermissionGrantMap>;

export type InterfacePostResolveCheck<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = (
  typename: keyof Types['Object'],
  parent: Shape,
  context: Types['Context'],
  grantedPermissions: GrantedPermissions,
) => MaybePromise<boolean | PermissionGrantMap>;

export type UnionPostResolveCheck<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Member extends keyof Types['Object']
> = (
  typename: Member,
  parent: Types['Object'][Member],
  context: Types['Context'],
  grantedPermissions: GrantedPermissions,
) => MaybePromise<boolean | PermissionGrantMap>;

export type PermissionCheckMap<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape> = {
  [s: string]: SharedPermissionCheck<Types, ParentShape>;
};

export type GrantPermissions<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape, Args> =
  | PermissionGrantMap
  | ((
      parent: ParentShape,
      args: Args,
      context: Types['Context'],
    ) => MaybePromise<PermissionGrantMap>);

export type PermissionCheck<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape, Args> =
  | string
  | string[]
  | PermissionMatcher
  | FieldPermissionCheck<Types, ParentShape, Args>;

export type PermissionMatcher =
  | {
      any: (string | PermissionMatcher)[];
      all?: undefined;
      sequential?: boolean;
    }
  | {
      all: (string | PermissionMatcher)[];
      any?: undefined;
      sequential?: boolean;
    };

export interface AuthFieldData {
  returnTypename: string;
  fieldName: string;
  fieldParentTypename: string;
  resolveChecks: ResolveChecksForType;
  permissionCheckers: PermissionCheckMap<any, any>;
  grantPermissions: GrantPermissions<any, any, any> | null;
  permissionCheck: PermissionCheck<any, any, any>;
}

export interface ResolveChecksForType {
  grantAsShared?: string;
  preResolveMap: Map<string, PreResolveCheck<any>>;
  postResolveMap: Map<string, Map<string, PostResolveCheck<any, unknown>>>;
}
