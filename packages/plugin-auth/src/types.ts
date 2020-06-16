import { GraphQLType, GraphQLNamedType, GraphQLObjectType, GraphQLInterfaceType } from 'graphql';
import { MaybePromise, SchemaTypes, ObjectParam, OutputShape } from '@giraphql/core';
import { GrantedPermissions } from './grant-map';

export interface AuthPluginOptions {
  requirePermissionChecks?: boolean;
  explicitMutationChecks?: boolean;
  skipPreResolveOnInterfaces?: boolean;
  skipPreResolveOnUnions?: boolean;
}

export type SharedPermissionCheck<Types extends SchemaTypes, ParentShape> = (
  parent: ParentShape,
  context: Types['context'],
) => MaybePromise<boolean>;

export type FieldPermissionCheck<Types extends SchemaTypes, ParentShape, Args> = (
  parent: ParentShape,
  args: Args,
  context: Types['context'],
) => MaybePromise<boolean | string | string[] | PermissionMatcher>;

export type PermissionGrantMap = { [s: string]: boolean | undefined };

export type PreResolveCheck<Types extends SchemaTypes> = (
  context: Types['context'],
) => MaybePromise<boolean | PermissionGrantMap>;

export type PostResolveCheck<Types extends SchemaTypes, Shape> = (
  parent: Shape,
  context: Types['context'],
  grantedPermissions: GrantedPermissions,
) => MaybePromise<boolean | PermissionGrantMap>;

export type InterfacePostResolveCheck<Types extends SchemaTypes, Shape> = (
  type: string,
  parent: Shape,
  context: Types['context'],
  grantedPermissions: GrantedPermissions,
) => MaybePromise<boolean | PermissionGrantMap>;

export type UnionPostResolveCheck<Types extends SchemaTypes, Member extends ObjectParam<Types>> = (
  typename: string,
  parent: OutputShape<Member, Types>,
  context: Types['context'],
  grantedPermissions: GrantedPermissions,
) => MaybePromise<boolean | PermissionGrantMap>;

export type PermissionCheckMap<Types extends SchemaTypes, ParentShape> = {
  [s: string]: SharedPermissionCheck<Types, ParentShape>;
};

export type GrantPermissions<Types extends SchemaTypes, ParentShape, Args> =
  | PermissionGrantMap
  | ((
      parent: ParentShape,
      args: Args,
      context: Types['context'],
    ) => MaybePromise<PermissionGrantMap>);

export type PermissionCheck<Types extends SchemaTypes, ParentShape, Args> =
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
  returnType: GraphQLType;
  unwrappedReturnType: GraphQLNamedType;
  fieldName: string;
  parentType: GraphQLObjectType | GraphQLInterfaceType;
  resolveChecks: ResolveChecksForType;
  permissionCheckers: PermissionCheckMap<any, any>;
  grantPermissions: GrantPermissions<any, any, any> | null;
  permissionCheck: PermissionCheck<any, any, any>;
}

export interface ResolveChecksForType {
  grantAsShared?: string;
  preResolveMap: Map<GraphQLNamedType, PreResolveCheck<any>>;
  postResolveMap: Map<GraphQLNamedType, Map<GraphQLNamedType, PostResolveCheck<any, unknown>>>;
}
