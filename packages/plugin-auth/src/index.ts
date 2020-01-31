/* eslint-disable no-param-reassign */
import {
  BaseType,
  BasePlugin,
  InputFields,
  TypeParam,
  Field,
  UnionType,
  InterfaceType,
  BuildCache,
  ObjectName,
  InterfaceName,
} from '@giraphql/core';
import {
  GraphQLFieldConfig,
  GraphQLResolveInfo,
  defaultFieldResolver,
  GraphQLOutputType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLUnionType,
  GraphQLInterfaceType,
} from 'graphql';
import { ForbiddenError } from 'apollo-server';
import AuthWrapper, { AuthMeta } from './auth-wrapper';
import './global-types';
import { AuthGrantMap, PreResolveAuthCheck } from './types';

export { AuthWrapper, AuthMeta };

export * from './types';

export function isScalar(type: GraphQLOutputType): boolean {
  if (type instanceof GraphQLNonNull) {
    return isScalar(type.ofType);
  }

  if (type instanceof GraphQLList) {
    return isScalar(type.ofType);
  }

  return type instanceof GraphQLScalarType || type instanceof GraphQLEnumType;
}

export function isList(type: GraphQLOutputType): boolean {
  if (type instanceof GraphQLNonNull) {
    return isList(type.ofType);
  }

  return type instanceof GraphQLList;
}

export function assertArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError('List resolvers must return arrays');
  }

  return true;
}

export function mergeAuthGrants(grants: AuthGrantMap, newGrants: AuthGrantMap) {
  Object.keys(newGrants).forEach(key => {
    if (!grants[key] && newGrants[key]) {
      grants[key] = true;
    }
  });
}

export default class AuthPlugin<Types extends GiraphQLSchemaTypes.TypeInfo>
  implements BasePlugin<Types> {
  authRequired: boolean;

  explicitMutationChecks: boolean;

  preResolveAuthCheckCache = new WeakMap<
    Types['Context'],
    Map<PreResolveAuthCheck<Types>, ReturnType<PreResolveAuthCheck<Types>>>
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

  updateFieldConfig(
    name: string,
    field: Field<InputFields<Types>, Types, TypeParam<Types>, TypeParam<Types>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    cache: BuildCache<Types>,
  ): GraphQLFieldConfig<unknown, unknown> {
    const resolver = config.resolve ?? defaultFieldResolver;

    const fieldName = `${field.parentTypename}.${name}`;
    const isListResolver = isList(config.type);
    const isScalarResolver = isScalar(config.type);

    const parentType = cache.getType(field.parentTypename);
    const nonListReturnType = Array.isArray(field.type) ? field.type[0] : field.type;
    const returnTypeName =
      typeof nonListReturnType === 'string'
        ? nonListReturnType
        : (nonListReturnType as BaseType<Types, string, {}>).typename;
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
      [s: string]: (parent: unknown, context: Types['Context']) => boolean | Promise<boolean>;
    };

    const preResolveCheck = returnType.kind === 'Object' && returnType.options.preResolveAuthCheck;

    const wrappedResolver = async (
      originalParent: unknown,
      args: {},
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => {
      const { parent, authData } =
        originalParent instanceof AuthWrapper
          ? originalParent
          : new AuthWrapper(originalParent, {});

      const { grantedAuth, checkCache } = authData;
      const authGrants: { [s: string]: boolean } = {};

      if (
        this.explicitMutationChecks &&
        fieldAuthChecks.length === 0 &&
        parentType.typename === 'Mutation'
      ) {
        throw new ForbiddenError(
          `${fieldName} is missing an explicit auth check which is required for all Mutations (explicitMutationChecks)`,
        );
      }

      if (authChecks.length === 0 && this.authRequired && !preResolveCheck) {
        throw new ForbiddenError(`No auth checks defined for ${fieldName}`);
      }

      const authResults = await Promise.all(
        authChecks.map(async authCheck => {
          const authName = typeof authCheck === 'string' ? authCheck : authCheck.name;

          if (typeof authCheck === 'function') {
            return Promise.resolve(authCheck(parent, args, context)).then(result => {
              if (result && typeof result === 'object') {
                mergeAuthGrants(authGrants, result);
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
              checkCache[authCheck] = authChecksFromType[authCheck](parent, context);
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
          throw new ForbiddenError(`${returnTypeName} preResolveCheck failed for ${fieldName}`);
        }

        if (typeof preResolveResult === 'object') {
          mergeAuthGrants(authGrants, preResolveResult);
        }
      }

      const result = await resolver(parent, args, context, info);

      return this.wrapReturn<Types>(result, authGrants, isListResolver, isScalarResolver);
    };

    wrappedResolver.unwrap = () => resolver;

    return {
      ...config,
      resolve: wrappedResolver as (...args: unknown[]) => unknown,
    };
  }

  visitUnionType(type: UnionType<Types, string, ObjectName<Types>>, built: GraphQLUnionType) {
    const { resolveType } = built;

    if (!resolveType) {
      return;
    }

    built.resolveType = (originalParent, context, info) => {
      const { parent } = originalParent as { parent: unknown };

      return (resolveType as Function)(parent, context, info);
    };
  }

  visitInterfaceType(
    type: InterfaceType<Types, InterfaceName<Types>>,
    built: GraphQLInterfaceType,
  ) {
    const { resolveType } = built;

    if (!resolveType) {
      return;
    }

    built.resolveType = (originalParent, context, info) => {
      const { parent } = originalParent as { parent: unknown };

      return (resolveType as Function)(parent, context, info);
    };
  }

  private wrapReturn<Types extends GiraphQLSchemaTypes.TypeInfo>(
    result: unknown,
    grantAuth: AuthMeta<Types>['grantedAuth'],
    isListResolver: boolean,
    isScalarResolver: boolean,
  ) {
    if (result === null || result === undefined || isScalarResolver) return result;

    if (isListResolver) {
      assertArray(result);
    }

    if (isListResolver) {
      return (result as unknown[]).map((parent: unknown) => {
        return new AuthWrapper(parent, grantAuth);
      });
    }

    return new AuthWrapper(result, grantAuth);
  }
}
