/* eslint-disable no-param-reassign */
import {
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

export { AuthWrapper, AuthMeta };

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

export default class AuthPlugin<Types extends GiraphQLSchemaTypes.TypeInfo>
  implements BasePlugin<Types> {
  authRequired: boolean;

  constructor(
    options: {
      authRequired: boolean;
    } = {
      authRequired: true,
    },
  ) {
    this.authRequired = options.authRequired;
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

    const fieldAuthChecks =
      typeof field.options.checkAuth === 'function' || typeof field.options.checkAuth === 'string'
        ? [field.options.checkAuth]
        : field.options.checkAuth;

    const authWith =
      fieldAuthChecks ??
      (parentType.kind === 'Object' ? parentType.options.defaultAuthChecks : []) ??
      [];

    const parentChecks = (parentType.kind === 'Object' || parentType.kind === 'Root'
      ? parentType.options.authChecks ?? {}
      : {}) as {
      [s: string]: (parent: unknown, context: Types['Context']) => boolean | Promise<boolean>;
    };

    const grantAuth = field.options.grantAuth as {
      [s: string]:
        | true
        | ((parent: unknown, context: Types['Context']) => boolean | Promise<boolean>);
    };

    const wrappedResolver = async (
      originalParent: unknown,
      args: {},
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => {
      const { parent, authData = { grantCache: {}, checkCache: {}, grantAuth: {} } } =
        originalParent instanceof AuthWrapper ? originalParent : { parent: originalParent };

      const { grantCache, checkCache } = authData;

      if (authWith.length === 0) {
        if (this.authRequired) {
          throw new ForbiddenError(`No auth checks defined for ${fieldName}`);
        }

        return this.wrapReturn(
          await resolver(parent, args, context, info),
          grantAuth,
          isListResolver,
          isScalarResolver,
        );
      }

      const authResults = await Promise.all(
        authWith.map(async authCheck => {
          const authName = typeof authCheck === 'string' ? authCheck : authCheck.name;
          if (typeof authCheck === 'function') {
            return Promise.resolve(authCheck(parent, context)).then(result => ({
              result,
              authName,
            }));
          }

          if (!parentChecks[authCheck] && !(authData.grantAuth && authData.grantAuth[authCheck])) {
            return Promise.resolve({ result: false, authName: authCheck });
          }

          if (authData.grantAuth && authData.grantAuth[authCheck]) {
            const check = authData.grantAuth[authCheck];

            if (!grantCache[authCheck]) {
              if (check === true) {
                grantCache[authCheck] = true;
              } else {
                grantCache[authCheck] = check(parent, context);
              }
            }

            if ((await grantCache[authCheck]) === true) {
              return { result: true, authName };
            }
          }

          if (parentChecks[authCheck]) {
            if (!checkCache[authCheck]) {
              checkCache[authCheck] = parentChecks[authCheck](parent, context);
            }

            const result = await checkCache[authCheck];

            return { result, authName };
          }

          return { result: false, authName };
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

      const result = await resolver(parent, args, context, info);

      return this.wrapReturn<Types>(result, grantAuth, isListResolver, isScalarResolver);
    };

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
    grantAuth: AuthMeta<Types>['grantAuth'],
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
