/* eslint-disable no-param-reassign */
import { BasePlugin, BuildCache, ResolveValueWrapper, MaybePromise } from '@giraphql/core';
import { GraphQLFieldConfig, GraphQLObjectType, GraphQLInterfaceType } from 'graphql';
import './global-types';
import { PreResolveCheck, AuthPluginOptions, PermissionGrantMap } from './types';
import AuthMeta from './auth-meta';
import GrantMap, { GrantedPermissions } from './grant-map';
import { checkFieldPermissions } from './check-field-permissions';
import { createFieldData } from './create-field-data';
import runPostResolveChecks from './post-resolve-check';
import runPreResolveChecks from './pre-resolve-checks';

export { AuthMeta, GrantMap, GrantedPermissions };

export * from './types';

export default class AuthPlugin implements BasePlugin {
  requirePermissionChecks: boolean;

  explicitMutationChecks: boolean;

  preResolveAuthCheckCache = new WeakMap<
    object,
    Map<PreResolveCheck<any>, MaybePromise<boolean | PermissionGrantMap>>
  >();

  skipPreResolveOnInterfaces: boolean;

  skipPreResolveOnUnions: boolean;

  constructor({
    requirePermissionChecks = true,
    explicitMutationChecks = true,
    skipPreResolveOnInterfaces = false,
    skipPreResolveOnUnions = false,
  }: AuthPluginOptions = {}) {
    this.requirePermissionChecks = requirePermissionChecks;
    this.explicitMutationChecks = explicitMutationChecks;
    this.skipPreResolveOnInterfaces = skipPreResolveOnInterfaces;
    this.skipPreResolveOnUnions = skipPreResolveOnUnions;
  }

  onFieldWrap(
    parentType: GraphQLObjectType | GraphQLInterfaceType,
    name: string,
    config: GraphQLFieldConfig<unknown, unknown>,
    data: GiraphQLSchemaTypes.FieldWrapData,
    cache: BuildCache<any>,
  ) {
    data.giraphqlAuth = createFieldData(parentType, name, config, cache, this);
  }

  async beforeResolve(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: object,
  ) {
    const { resolveChecks, grantPermissions, parentType, unwrappedReturnType } = data.giraphqlAuth;

    if (!parent.data.giraphqlAuth) {
      parent.data.giraphqlAuth = new AuthMeta();
    }

    if (parentType.name === 'Subscription') {
      return {
        async onWrap(child: ResolveValueWrapper) {
          child.data.giraphqlAuth = new AuthMeta(
            parent.data.giraphqlAuth?.grantedPermissions.clone(),
          );

          return runPostResolveChecks(unwrappedReturnType, data, child, context);
        },
      };
    }

    await checkFieldPermissions(
      this.requirePermissionChecks && !resolveChecks.preResolveMap.has(unwrappedReturnType),
      parent,
      data,
      args,
      context,
    );

    const newGrants = await runPreResolveChecks(data, context, this);

    if (grantPermissions) {
      const grants =
        typeof grantPermissions === 'function'
          ? await grantPermissions(parent.value, args, context)
          : grantPermissions;

      newGrants.mergeSharedGrants(grants);
    }

    return {
      async onWrap(child: ResolveValueWrapper) {
        child.data.giraphqlAuth = new AuthMeta(newGrants);

        return runPostResolveChecks(unwrappedReturnType, data, child, context);
      },
    };
  }

  async beforeSubscribe(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: object,
  ) {
    const { resolveChecks, unwrappedReturnType, grantPermissions } = data.giraphqlAuth;

    if (!parent.data.giraphqlAuth) {
      parent.data.giraphqlAuth = new AuthMeta();
    }

    await checkFieldPermissions(
      this.requirePermissionChecks && !resolveChecks.preResolveMap.has(unwrappedReturnType),
      parent,
      data,
      args,
      context,
    );

    const newGrants = await runPreResolveChecks(data, context, this);

    if (grantPermissions) {
      const grants =
        typeof grantPermissions === 'function'
          ? await grantPermissions(parent.value, args, context)
          : grantPermissions;

      newGrants.mergeSharedGrants(grants);
    }

    return {
      onWrap(child: ResolveValueWrapper) {
        child.data.giraphqlAuth = new AuthMeta(newGrants);
      },
    };
  }

  async onInterfaceResolveType(
    type: GraphQLObjectType,
    parent: ResolveValueWrapper,
    context: object,
  ) {
    return runPostResolveChecks(type, parent.data.parentFieldData!, parent, context);
  }

  async onUnionResolveType(type: GraphQLObjectType, parent: ResolveValueWrapper, context: object) {
    return runPostResolveChecks(type, parent.data.parentFieldData!, parent, context);
  }
}
