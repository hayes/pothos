import { GraphQLFieldResolver } from 'graphql';
import { isThenable, SchemaTypes } from '@pothos/core';
import {
  FieldAuthScopes,
  FieldGrantScopes,
  ResolveStep,
  TypeAuthScopes,
  TypeGrantScopes,
} from './types';

export function createTypeAuthScopesStep<Types extends SchemaTypes>(
  authScopes: TypeAuthScopes<Types, unknown>,
  type: string,
): ResolveStep<Types> {
  if (typeof authScopes === 'function') {
    return {
      run: (state, parent, args, context, info) =>
        state.evaluateTypeScopeFunction(authScopes, type, parent, info),
      errorMessage: `Not authorized to read fields for ${type}`,
    };
  }

  return {
    run: (state, parent, args, context, info) => state.evaluateScopeMap(authScopes, info),
    errorMessage: `Not authorized to read fields for ${type}`,
  };
}

export function createTypeGrantScopesStep<Types extends SchemaTypes>(
  grantScopes: TypeGrantScopes<Types, unknown>,
  type: string,
  forField: boolean,
): ResolveStep<Types> {
  return {
    run: (state, parent, args, context, info) =>
      state.grantTypeScopes(type, parent, forField ? info.path.prev : info.path, () =>
        grantScopes(parent, context),
      ),
    errorMessage: `Unknown error creating grants for ${type}`,
  };
}

export function createFieldAuthScopesStep<Types extends SchemaTypes>(
  authScopes: FieldAuthScopes<Types, {}, {}>,
): ResolveStep<Types> {
  if (typeof authScopes === 'function') {
    return {
      errorMessage: (parent, args, context, info) =>
        `Not authorized to resolve ${info.parentType}.${info.fieldName}`,
      run: (state, parent, args, context, info) => {
        const scopeMap = authScopes(parent as {}, args, context, info);

        if (isThenable(scopeMap)) {
          return scopeMap.then((resolved) => state.evaluateScopeMap(resolved, info));
        }

        return state.evaluateScopeMap(scopeMap, info);
      },
    };
  }

  return {
    errorMessage: (parent, args, context, info) =>
      `Not authorized to resolve ${info.parentType}.${info.fieldName}`,
    run: (state, parent, args, context, info) => state.evaluateScopeMap(authScopes, info),
  };
}

export function createFieldGrantScopesStep<Types extends SchemaTypes>(
  grantScopes: FieldGrantScopes<Types, {}, {}>,
): ResolveStep<Types> {
  return {
    errorMessage: (parent, args, context, info) =>
      `Unknown issue generating grants for ${info.parentType}.${info.fieldName}`,
    run: (state, parent, args, context, info) => {
      if (typeof grantScopes !== 'function') {
        state.saveGrantedScopes(grantScopes, info.path);

        return null;
      }
      const result = grantScopes(parent as {}, args, context, info);

      if (isThenable(result)) {
        return result.then((resolved) => {
          state.saveGrantedScopes(resolved, info.path);

          return null;
        });
      }

      state.saveGrantedScopes(result, info.path);

      return null;
    },
  };
}

export function createResolveStep<Types extends SchemaTypes>(
  resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
): ResolveStep<Types> {
  return {
    errorMessage: (parent, args, context, info) =>
      `Unknown issue resolving ${info.parentType}.${info.fieldName}`,
    run: (state, parent, args, context, info, setResolved) => {
      const result: unknown = resolver(parent, args, context, info);

      if (isThenable(result)) {
        return Promise.resolve(result).then((resolved) => {
          setResolved(resolved);

          return null;
        });
      }

      setResolved(result);

      return null;
    },
  };
}
