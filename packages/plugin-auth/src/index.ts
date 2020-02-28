/* eslint-disable no-param-reassign */
import {
  BaseType,
  BasePlugin,
  TypeParam,
  Field,
  BuildCache,
  ResolveValueWrapper,
} from '@giraphql/core';
import { GraphQLFieldConfig } from 'graphql';
import { ForbiddenError } from 'apollo-server';
import './global-types';
import {
  AuthGrantMap,
  PreResolveCheck,
  PermissionsCheck,
  PermissionMatcher,
  PostResolveCheck,
} from './types';
import AuthMeta from './auth-wrapper';

export { AuthMeta };

export * from './types';

export function mergeAuthGrants(grants: AuthGrantMap, newGrants: AuthGrantMap) {
  Object.keys(newGrants).forEach(key => {
    if (!grants[key] && newGrants[key]) {
      grants[key] = true;
    }
  });
}

async function resolvePermissionCheck(
  check: PermissionsCheck<any, any, any>,
  parent: unknown,
  args: unknown,
  context: unknown,
): Promise<PermissionMatcher | boolean> {
  if (typeof check === 'string') {
    return { all: [check] };
  }

  if (Array.isArray(check)) {
    return { all: check };
  }

  const result = await check(parent, args, context);

  if (typeof result === 'string') {
    return { all: [result] };
  }

  if (Array.isArray(result)) {
    return { all: result };
  }

  return result;
}

function permissionsFromMatcher(
  matcher: PermissionMatcher,
  fieldName: string,
  permissionRequired: boolean,
  set: Set<string> = new Set(),
) {
  const list = matcher.all || matcher.any;

  if (permissionRequired && list.length === 0) {
    throw new ForbiddenError(`No permission checks defined for ${fieldName}`);
  }

  list.forEach(next => {
    if (typeof next === 'string') {
      set.add(next);
    } else {
      permissionsFromMatcher(next, fieldName, permissionRequired, set);
    }

    return set;
  });

  return set;
}

async function checkFieldPermissions(
  required: boolean,
  parent: ResolveValueWrapper,
  data: GiraphQLSchemaTypes.FieldWrapData,
  args: object,
  context: object,
) {
  const { fieldName, permissionChecksFromType, permissionCheck } = data.giraphqlAuth;
  const checkResult = await resolvePermissionCheck(permissionCheck, parent.value, args, context);

  if (typeof checkResult === 'boolean') {
    if (!checkResult) {
      throw new ForbiddenError(`Permission check on ${fieldName} failed.`);
    }

    return;
  }

  const permissions = permissionsFromMatcher(checkResult, fieldName, required);

  const { grantedPermissions, checkCache } = parent.data.giraphqlAuth!;

  const permissionResults = new Map<string, boolean>();

  await Promise.all(
    [...permissions].map(async perm => {
      if (grantedPermissions[perm]) {
        permissionResults.set(perm, true);

        return;
      }

      if (permissionChecksFromType[perm]) {
        if (!checkCache[perm]) {
          checkCache[perm] = permissionChecksFromType[perm](parent.value, context);
        }

        const result = await checkCache[perm];

        permissionResults.set(perm, result);

        return;
      }

      permissionResults.set(perm, false);
    }),
  );

  const failures = evaluateMatcher(checkResult, permissionResults, fieldName);

  if (failures) {
    const { failedChecks, type } = failures;

    if (type === 'any') {
      throw new ForbiddenError(
        `Permission check on ${fieldName} failed. Missing ${
          failedChecks.size > 1 ? 'one of the following permissions' : 'the following permission'
        }: ${[...failedChecks].join(', ')})`,
      );
    }

    throw new ForbiddenError(
      `Permission check on ${fieldName} failed. Missing the following permission${
        failedChecks.size > 1 ? 's' : ''
      }: ${[...failedChecks].join(', ')}`,
    );
  }
}

function evaluateMatcher(
  matcher: PermissionMatcher,
  permissions: Map<string, boolean>,
  fieldName: string,
  failedChecks: Set<string> = new Set(),
): null | { failedChecks: Set<string>; type: 'any' | 'all' } {
  if (matcher.all) {
    if (!matcher.all.length) {
      throw new Error(
        `Received an "all" permission matcher with an empty empty list of permissions for ${fieldName}`,
      );
    }

    for (const perm of matcher.all) {
      if (typeof perm === 'string' && permissions.get(perm) !== true) {
        failedChecks.add(perm);
      } else if (typeof perm === 'object') {
        evaluateMatcher(perm, permissions, fieldName, failedChecks);
      }
    }

    if (failedChecks.size === 0) {
      return null;
    }
  } else {
    if (!matcher.any.length) {
      throw new Error(
        `Received an "any" permission matcher with an empty empty list of permissions for ${fieldName}`,
      );
    }

    for (const perm of matcher.any) {
      if (typeof perm === 'string' && permissions.get(perm) === true) {
        return null;
      }

      if (typeof perm === 'string') {
        failedChecks.add(perm);
      } else if (typeof perm === 'object') {
        evaluateMatcher(perm, permissions, fieldName, failedChecks);
      }
    }
  }

  return {
    type: matcher.all ? 'all' : 'any',
    failedChecks,
  };
}

export default class AuthPlugin implements BasePlugin {
  requirePermissionChecks: boolean;

  explicitMutationChecks: boolean;

  preResolveAuthCheckCache = new WeakMap<
    object,
    Map<PreResolveCheck<any>, ReturnType<PreResolveCheck<any>>>
  >();

  constructor({
    requirePermissionChecks = true,
    explicitMutationChecks = true,
  }: {
    requirePermissionChecks?: boolean;
    explicitMutationChecks?: boolean;
  } = {}) {
    this.requirePermissionChecks = requirePermissionChecks;
    this.explicitMutationChecks = explicitMutationChecks;
  }

  onFieldWrap(
    name: string,
    field: Field<{}, any, TypeParam<any>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    data: GiraphQLSchemaTypes.FieldWrapData,
    cache: BuildCache,
  ) {
    const parentType = cache.getType(field.parentTypename);
    const nonListReturnType = Array.isArray(field.type) ? field.type[0] : field.type;
    const returnTypename =
      typeof nonListReturnType === 'string'
        ? nonListReturnType
        : (nonListReturnType as BaseType).typename;
    const returnType = cache.getType(returnTypename);

    const permissionCheck: PermissionsCheck<any, any, any> =
      field.options.permissionsCheck ||
      (parentType.kind === 'Object' && parentType.options.defaultPermissionCheck) ||
      [];

    const permissionChecksFromType = (parentType.kind === 'Object' ||
    parentType.kind === 'Query' ||
    parentType.kind === 'Mutation' ||
    parentType.kind === 'Subscription'
      ? parentType.options.permissions ?? {}
      : {}) as {
      [s: string]: (parent: unknown, context: {}) => boolean | Promise<boolean>;
    };

    const preResolveCheck =
      (returnType.kind === 'Object' && returnType.options.preResolveCheck) || undefined;

    const postResolveCheck =
      (returnType.kind === 'Object' && returnType.options.postResolveCheck) || undefined;

    const fieldName = `${field.parentTypename}.${name}`;

    if (
      this.explicitMutationChecks &&
      field.parentTypename === 'Mutation' &&
      (!field.options.permissionsCheck || field.options.permissionsCheck.length === 0)
    ) {
      throw new Error(
        `${fieldName} is missing an explicit permission check which is required for all Mutations (explicitMutationChecks)`,
      );
    }

    const postResolveMap = new Map<string, PostResolveCheck<any, unknown> | null>();

    if (returnType.kind === 'Interface') {
      const implementers = cache.getImplementers(returnType.typename);

      implementers.forEach(implementer => {
        postResolveMap.set(implementer.typename, implementer.options.postResolveCheck || null);
      });
    } else if (returnType.kind === 'Union') {
      const members = returnType.members.map(member => cache.getEntryOfType(member, 'Object').type);

      members.forEach(member => {
        postResolveMap.set(member.typename, member.options.postResolveCheck || null);
      });
    }

    const grantPermissions = field.options.grantPermissions || null;

    data.giraphqlAuth = {
      returnTypename,
      fieldName,
      permissionCheck,
      permissionChecksFromType,
      preResolveCheck,
      postResolveCheck,
      postResolveMap,
      grantPermissions,
    };
  }

  async beforeResolve(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: object,
  ) {
    const {
      preResolveCheck,
      postResolveCheck,
      returnTypename,
      fieldName,
      grantPermissions,
      postResolveMap,
    } = data.giraphqlAuth;

    if (!parent.data.giraphqlAuth) {
      parent.data.giraphqlAuth = new AuthMeta(postResolveMap);
    }

    await checkFieldPermissions(
      this.requirePermissionChecks && !preResolveCheck,
      parent,
      data,
      args,
      context,
    );

    const newGrants = {};

    if (preResolveCheck) {
      if (!this.preResolveAuthCheckCache.has(context)) {
        this.preResolveAuthCheckCache.set(context, new Map());
      }
      const preResolveCache = this.preResolveAuthCheckCache.get(context)!;

      if (!preResolveCache.has(preResolveCheck)) {
        preResolveCache.set(preResolveCheck, preResolveCheck(context));
      }

      const preResolveResult = await preResolveCache.get(preResolveCheck);

      if (!preResolveResult) {
        throw new ForbiddenError(`${returnTypename} preResolveCheck failed for ${fieldName}`);
      }

      if (typeof preResolveResult === 'object') {
        mergeAuthGrants(newGrants, preResolveResult);
      }
    }

    if (grantPermissions) {
      mergeAuthGrants(newGrants, await grantPermissions(parent.value, args, context));
    }

    return {
      async onWrap(child: ResolveValueWrapper) {
        const grants = { ...newGrants };

        if (postResolveCheck) {
          const postResolveResult = await postResolveCheck(child.value, context);

          if (!postResolveResult) {
            throw new ForbiddenError(`${returnTypename} postResolveCheck failed for ${fieldName}`);
          }

          if (typeof postResolveResult === 'object') {
            mergeAuthGrants(grants, postResolveResult);
          }
        }

        child.data.giraphqlAuth = new AuthMeta(postResolveMap, grants);
      },
    };
  }

  async onInterfaceResolveType(typename: string, parent: ResolveValueWrapper, context: object) {
    const postResolveCheck = parent.data.giraphqlAuth?.postResolveMap.get(typename);

    if (postResolveCheck) {
      const postResolveResult = await postResolveCheck(parent.value, context);

      if (!postResolveResult) {
        throw new ForbiddenError(`${typename} postResolveCheck failed for ${parent.fieldName}`);
      }

      if (typeof postResolveResult === 'object') {
        mergeAuthGrants(parent.data.giraphqlAuth!.grantedPermissions, postResolveResult);
      }
    }
  }

  async onUnionResolveType(typename: string, parent: ResolveValueWrapper, context: object) {
    const postResolveCheck = parent.data.giraphqlAuth?.postResolveMap.get(typename);

    if (postResolveCheck) {
      const postResolveResult = await postResolveCheck(parent.value, context);

      if (!postResolveResult) {
        throw new ForbiddenError(`${typename} postResolveCheck failed for ${parent.fieldName}`);
      }

      if (typeof postResolveResult === 'object') {
        mergeAuthGrants(parent.data.giraphqlAuth!.grantedPermissions, postResolveResult);
      }
    }
  }
}
