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
import { AuthGrantMap, PreResolveAuthCheck } from './types';
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

export default class AuthPlugin implements BasePlugin {
  authRequired: boolean;

  explicitMutationChecks: boolean;

  preResolveAuthCheckCache = new WeakMap<
    object,
    Map<PreResolveAuthCheck<any>, ReturnType<PreResolveAuthCheck<any>>>
  >();

  constructor({
    authRequired = true,
    explicitMutationChecks = true,
  }: {
    authRequired?: boolean;
    explicitMutationChecks?: boolean;
  } = {}) {
    this.authRequired = authRequired;
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
    const returnTypeName =
      typeof nonListReturnType === 'string'
        ? nonListReturnType
        : (nonListReturnType as BaseType).typename;
    const returnType = cache.getType(returnTypeName);

    const fieldAuthChecks =
      (field.options.checkAuth &&
        (Array.isArray(field.options.checkAuth)
          ? field.options.checkAuth
          : [field.options.checkAuth])) ||
      [];

    let authChecks = fieldAuthChecks;

    if (!field.options.checkAuth) {
      const defaultAuthChecks =
        (parentType.kind === 'Object' && parentType.options.defaultAuthChecks) || [];

      authChecks = defaultAuthChecks;
    }

    const authChecksFromType = (parentType.kind === 'Object' || parentType.kind === 'Root'
      ? parentType.options.authChecks ?? {}
      : {}) as {
      [s: string]: (parent: unknown, context: {}) => boolean | Promise<boolean>;
    };

    const preResolveCheck =
      (returnType.kind === 'Object' && returnType.options.preResolveAuthCheck) || undefined;

    data.giraphqlAuth = {
      parentTypename: parentType.typename,
      returnTypename: returnTypeName,
      fieldName: `${field.parentTypename}.${name}`,
      authChecks,
      authChecksFromType,
      preResolveCheck,
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
      authChecks,
      authChecksFromType,
      parentTypename,
      returnTypename,
      fieldName,
    } = data.giraphqlAuth;

    if (this.explicitMutationChecks && authChecks.length === 0 && parentTypename === 'Mutation') {
      throw new ForbiddenError(
        `${fieldName} is missing an explicit auth check which is required for all Mutations (explicitMutationChecks)`,
      );
    }

    if (authChecks.length === 0 && this.authRequired && !preResolveCheck) {
      throw new ForbiddenError(`No auth checks defined for ${fieldName}`);
    }

    if (!parent.data.giraphqlAuth) {
      parent.data.giraphqlAuth = new AuthMeta();
    }

    const newGrants = {};

    const { grantedAuth, checkCache } = parent.data.giraphqlAuth!;

    const authResults = await Promise.all(
      authChecks.map(async authCheck => {
        const authName = typeof authCheck === 'string' ? authCheck : authCheck.name;

        if (typeof authCheck === 'function') {
          return Promise.resolve(authCheck(parent.value, args, context)).then(result => {
            if (result && typeof result === 'object') {
              mergeAuthGrants(newGrants, result);
            }

            return {
              result: !!result,
              authName,
            };
          });
        }

        if (grantedAuth[authCheck]) {
          return { result: true, authName };
        }

        if (authChecksFromType[authCheck]) {
          if (!checkCache[authCheck]) {
            checkCache[authCheck] = authChecksFromType[authCheck](parent.value, context);
          }

          const result = await checkCache[authCheck];

          return { result, authName };
        }

        return { result: false, authName: authCheck };
      }),
    );

    const failedChecks = authResults
      .filter(({ result }) => !result)
      .map(({ authName }) => authName);

    if (failedChecks.length !== 0) {
      throw new ForbiddenError(
        `Failed ${failedChecks.length} auth check${
          failedChecks.length > 1 ? 's' : ''
        } on ${fieldName} (${failedChecks.map(n => n || '[anonymous]').join(', ')})`,
      );
    }

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

    return {
      onWrap(child: ResolveValueWrapper) {
        child.data.giraphqlAuth = new AuthMeta(newGrants);
      },
    };
  }
}
