/* eslint-disable no-param-reassign */
import {
  BaseType,
  BasePlugin,
  TypeParam,
  Field,
  BuildCache,
  ResolveValueWrapper,
} from '@giraphql/core';
import { GraphQLFieldConfig, GraphQLResolveInfo } from 'graphql';
import { ForbiddenError } from 'apollo-server';
import './global-types';
import {
  PermissionGrantMap,
  PreResolveCheck,
  PermissionCheck,
  PermissionMatcher,
  PostResolveCheck,
  AuthPluginOptions,
} from './types';
import AuthMeta from './auth-wrapper';

export { AuthMeta };

export * from './types';

export function mergePermGrants(grants: PermissionGrantMap, newGrants: PermissionGrantMap) {
  Object.keys(newGrants).forEach(key => {
    if (!grants[key] && newGrants[key]) {
      grants[key] = true;
    }
  });
}

async function resolvePermissionCheck(
  check: PermissionCheck<any, any, any>,
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

  if (typeof check !== 'function') {
    return check;
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

async function evaluateMatcher(
  matcher: PermissionMatcher,
  fieldName: string,
  getResult: (perm: string) => Promise<boolean>,
  failedChecks: Set<string> = new Set(),
): Promise<null | { failedChecks: Set<string>; type: 'any' | 'all' }> {
  const pending: Promise<unknown>[] = [];

  if (matcher.all) {
    if (matcher.all.length === 0) {
      throw new Error(
        `Received an "all" permission matcher with an empty empty list of permissions for ${fieldName}`,
      );
    }

    for (const perm of matcher.all) {
      const permPromise =
        typeof perm === 'string'
          ? getResult(perm).then(result => {
              if (!result) {
                failedChecks.add(perm);
              }

              return result;
            })
          : evaluateMatcher(perm, fieldName, getResult, failedChecks).then(result => !result);

      if (matcher.sequential) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await permPromise)) {
          break;
        }
      } else {
        pending.push(permPromise);
      }
    }

    await Promise.all(pending);

    if (failedChecks.size === 0) {
      return null;
    }
  } else {
    if (matcher.any.length === 0) {
      throw new Error(
        `Received an "any" permission matcher with an empty empty list of permissions for ${fieldName}`,
      );
    }

    for (const perm of matcher.any) {
      const permPromise =
        typeof perm === 'string'
          ? getResult(perm).then(result => {
              if (!result) {
                failedChecks.add(perm);
              }
              return result;
            })
          : evaluateMatcher(perm, fieldName, getResult, failedChecks).then(result => !result);

      if (matcher.sequential) {
        // eslint-disable-next-line no-await-in-loop
        if (await permPromise) {
          return null;
        }
      } else {
        pending.push(permPromise);
      }
    }

    const results = await Promise.all(pending);

    if (results.find(value => value)) {
      return null;
    }
  }

  return {
    type: matcher.all ? 'all' : 'any',
    failedChecks,
  };
}

async function checkFieldPermissions(
  required: boolean,
  parent: ResolveValueWrapper,
  data: GiraphQLSchemaTypes.FieldWrapData,
  args: object,
  context: object,
) {
  const { fieldName, permissionChecksFromType, permissionCheck } = data.giraphqlAuth;

  if (Array.isArray(permissionCheck) && permissionCheck.length === 0) {
    if (required) {
      throw new ForbiddenError(`Missing permission check on ${fieldName}.`);
    }

    return;
  }

  const checkResult = await resolvePermissionCheck(permissionCheck, parent.value, args, context);

  if (typeof checkResult === 'boolean') {
    if (!checkResult) {
      throw new ForbiddenError(`Permission check on ${fieldName} failed.`);
    }

    return;
  }

  const { grantedPermissions, checkCache } = parent.data.giraphqlAuth!;

  const permissionResults = new Map<string, boolean>();

  const failures = await evaluateMatcher(checkResult, fieldName, async perm => {
    if (permissionResults.has(perm)) {
      return permissionResults.has(perm);
    }

    if (grantedPermissions[perm]) {
      permissionResults.set(perm, true);

      return true;
    }

    if (permissionChecksFromType[perm]) {
      if (!checkCache[perm]) {
        checkCache[perm] = permissionChecksFromType[perm](parent.value, context);
      }

      const result = await checkCache[perm];

      permissionResults.set(perm, result);

      return result;
    }

    return false;
  });

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
  }: AuthPluginOptions = {}) {
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

    const permissionCheck: PermissionCheck<any, any, any> =
      field.options.permissionCheck ||
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
      (!field.options.permissionCheck ||
        (Array.isArray(field.options.permissionCheck) &&
          field.options.permissionCheck.length === 0))
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
        mergePermGrants(newGrants, preResolveResult);
      }
    }

    if (grantPermissions) {
      const grants =
        typeof grantPermissions === 'function'
          ? await grantPermissions(parent.value, args, context)
          : grantPermissions;
      mergePermGrants(newGrants, grants);
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
            mergePermGrants(grants, postResolveResult);
          }
        }

        // eslint-disable-next-line require-atomic-updates
        child.data.giraphqlAuth = new AuthMeta(postResolveMap, grants);
      },
    };
  }

  async onInterfaceResolveType(
    typename: string,
    parent: ResolveValueWrapper,
    context: object,
    info: GraphQLResolveInfo,
  ) {
    const postResolveCheck = parent.data.giraphqlAuth?.postResolveMap.get(typename);

    if (postResolveCheck) {
      const postResolveResult = await postResolveCheck(parent.value, context);

      if (!postResolveResult) {
        throw new ForbiddenError(
          `${typename} postResolveCheck failed for ${info.parentType.name}.${info.fieldName}`,
        );
      }

      if (typeof postResolveResult === 'object') {
        mergePermGrants(parent.data.giraphqlAuth!.grantedPermissions, postResolveResult);
      }
    }
  }

  async onUnionResolveType(
    typename: string,
    parent: ResolveValueWrapper,
    context: object,
    info: GraphQLResolveInfo,
  ) {
    const postResolveCheck = parent.data.giraphqlAuth?.postResolveMap.get(typename);

    if (postResolveCheck) {
      const postResolveResult = await postResolveCheck(parent.value, context);

      if (!postResolveResult) {
        throw new ForbiddenError(
          `${typename} postResolveCheck failed for ${info.parentType.name}.${info.fieldName}`,
        );
      }

      if (typeof postResolveResult === 'object') {
        mergePermGrants(parent.data.giraphqlAuth!.grantedPermissions, postResolveResult);
      }
    }
  }
}
