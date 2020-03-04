import { InputFields, InputShapeFromFields, MaybePromise } from '@giraphql/core';

export interface AuthPluginOptions {
  requirePermissionChecks?: boolean;
  explicitMutationChecks?: boolean;
}

export type SharedPermissionCheck<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape> = (
  parent: ParentShape,
  context: Types['Context'],
) => MaybePromise<boolean>;

export type FieldPermissionCheck<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Args extends InputFields<Types>
> = (
  parent: ParentShape,
  args: Args,
  context: Types['Context'],
) => MaybePromise<boolean | string | string[] | PermissionMatcher>;

export type AuthGrantMap = { [s: string]: boolean };

export type PreResolveCheck<Types extends GiraphQLSchemaTypes.TypeInfo> = (
  context: Types['Context'],
) => MaybePromise<boolean | AuthGrantMap>;

export type PostResolveCheck<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = (
  parent: Shape,
  context: Types['Context'],
) => MaybePromise<boolean | AuthGrantMap>;

export type PermissionCheckMap<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape> = {
  [s: string]: SharedPermissionCheck<Types, ParentShape>;
};

export type GrantPermissions<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Args extends InputFields<Types>
> = (
  parent: ParentShape,
  args: InputShapeFromFields<Types, Args>,
  context: Types['Context'],
) => MaybePromise<AuthGrantMap>;

export type PermissionsCheck<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Args extends InputFields<Types>
> = string | string[] | FieldPermissionCheck<Types, ParentShape, Args>;

export type PermissionMatcher =
  | {
      any: (string | PermissionMatcher)[];
      all?: undefined;
    }
  | {
      all: (string | PermissionMatcher)[];
      any?: undefined;
    };
