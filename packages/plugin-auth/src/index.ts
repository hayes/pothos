/* eslint-disable no-param-reassign */
import {
  BasePlugin,
  TypeParam,
  Field,
  BuildCache,
  ResolveValueWrapper,
  MaybePromise,
} from '@giraphql/core';
import { GraphQLFieldConfig } from 'graphql';
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
    name: string,
    field: Field<{}, any, TypeParam<any>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    data: GiraphQLSchemaTypes.FieldWrapData,
    cache: BuildCache,
  ) {
    data.giraphqlAuth = createFieldData(name, field, cache, this);
  }

  async beforeResolve(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: object,
  ) {
    const {
      resolveChecks,
      returnTypename,
      grantPermissions,
      fieldParentTypename,
    } = data.giraphqlAuth;

    if (!parent.data.giraphqlAuth) {
      parent.data.giraphqlAuth = new AuthMeta();
    }

    if (fieldParentTypename === 'Subscription') {
      return {
        async onWrap(child: ResolveValueWrapper) {
          child.data.giraphqlAuth = new AuthMeta(
            parent.data.giraphqlAuth?.grantedPermissions.clone(),
          );

          return runPostResolveChecks(returnTypename, data, child, context);
        },
      };
    }

    await checkFieldPermissions(
      this.requirePermissionChecks && !resolveChecks.preResolveMap.has(returnTypename),
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

        return runPostResolveChecks(returnTypename, data, child, context);
      },
    };
  }

  async beforeSubscribe(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: object,
  ) {
    const { resolveChecks, returnTypename, grantPermissions } = data.giraphqlAuth;

    if (!parent.data.giraphqlAuth) {
      parent.data.giraphqlAuth = new AuthMeta();
    }

    await checkFieldPermissions(
      this.requirePermissionChecks && !resolveChecks.preResolveMap.has(returnTypename),
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

  async onInterfaceResolveType(typename: string, parent: ResolveValueWrapper, context: object) {
    return runPostResolveChecks(typename, parent.data.parentFieldData!, parent, context);
  }

  async onUnionResolveType(typename: string, parent: ResolveValueWrapper, context: object) {
    return runPostResolveChecks(typename, parent.data.parentFieldData!, parent, context);
  }
}
