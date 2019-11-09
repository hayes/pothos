/* eslint-disable @typescript-eslint/no-unused-vars */
import { BasePlugin, InputFields, TypeParam, Field, TypeStore } from '@giraphql/core';
import {
  GraphQLFieldConfig,
  GraphQLResolveInfo,
  defaultFieldResolver,
  GraphQLOutputType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLScalarType,
  GraphQLEnumType,
} from 'graphql';
import { ForbiddenError } from 'apollo-server';
import './global-types';

type AuthMeta<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  grantAuth?: {
    [s: string]:
      | true
      | ((parent: unknown, context: Types['Context']) => boolean | Promise<boolean>);
  };
  grantCache?: {
    [s: string]: boolean | Promise<boolean>;
  };
  checkCache?: {
    [s: string]: boolean | Promise<boolean>;
  };
};

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

function wrapReturn<Types extends GiraphQLSchemaTypes.TypeInfo>(
  result: unknown,
  authData: AuthMeta<Types>,
  isListResolver: boolean,
  isScalarResolver: boolean,
) {
  if (!result || isScalarResolver) return result;

  if (isListResolver) {
    assertArray(result);
  }

  return isListResolver
    ? (result as unknown[]).map((parent: unknown) => ({
        parent,
        authData,
      }))
    : { parent: result, authData };
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
    store: TypeStore<Types>,
  ): GraphQLFieldConfig<unknown, unknown> {
    const resolver = config.resolve || defaultFieldResolver;

    const fieldName = `${field.parentTypename}.${name}`;
    const isListResolver = isList(config.type);
    const isScalarResolver = isScalar(config.type);
    const isRootResolver = ['Query', 'Mutation', 'Subscription'].includes(
      field.parentTypename as string,
    );

    const authWith = field.options.authWith || [];

    const parentType = store.getType(field.parentTypename);
    const parentChecks = (parentType.kind === 'Object'
      ? parentType.options.authChecks || {}
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
      const { parent, authData = {} } = isRootResolver
        ? { parent: originalParent }
        : (originalParent as { parent: unknown; authData: AuthMeta<Types> });

      const { grantCache = {}, checkCache = {} } = authData;

      if (authWith.length === 0) {
        if (this.authRequired) {
          throw new ForbiddenError(`No authWith checks provided for ${fieldName}`);
        }

        return wrapReturn(
          await resolver(parent, args, context, info),
          isScalarResolver ? {} : authData,
          isListResolver,
          isScalarResolver,
        );
      }

      const authResults = await Promise.all(
        authWith.map(authName => {
          if (!parentChecks[authName] && !(authData.grantAuth && authData.grantAuth[authName])) {
            return Promise.resolve({ result: false, authName });
          }

          return (async () => {
            if (authData.grantAuth && authData.grantAuth[authName]) {
              if (!grantCache[authName]) {
                const check = authData.grantAuth[authName];

                if (check === true) {
                  grantCache[authName] = true;
                } else {
                  grantCache[authName] = check(parent, context);
                }
              }

              if ((await grantCache[authName]) === true) {
                return true;
              }
            }

            if (parentChecks[authName]) {
              if (!checkCache[authName]) {
                checkCache[authName] = parentChecks[authName](parent, context);
              }

              return checkCache[authName];
            }

            return false;
          })()
            .catch(
              error =>
                new ForbiddenError(`Error performing authCheck (${authName} on ${fieldName})`),
            )
            .then(result => ({ result, authName }));
        }),
      );

      const failedChecks = authResults
        .filter(({ result }) => !result)
        .map(({ authName }) => authName);

      if (failedChecks.length !== 0) {
        throw new ForbiddenError(
          `Failed to auth checks on ${fieldName} (${failedChecks.join(', ')})`,
        );
      }

      const result = await resolver(parent, args, context, info);

      return wrapReturn<Types>(
        result,
        {
          grantAuth,
          grantCache: {},
          checkCache: {},
        },
        isListResolver,
        isScalarResolver,
      );
    };

    return {
      ...config,
      resolve: wrappedResolver as (...args: unknown[]) => unknown,
    };
  }
}
