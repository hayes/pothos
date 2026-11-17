import { isThenable, type SchemaTypes } from '@pothos/core';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type {
  FieldAuthScopes,
  FieldGrantScopes,
  ResolveStep,
  TypeAuthScopes,
  TypeGrantScopes,
  TypeScopeInfo,
} from './types.js';

export function typeAuthScopesStepKey(type: string) {
  return `authScopes:${type}`;
}

export function typeGrantScopesStepKey(type: string) {
  return `grantScopes:${type}`;
}

/**
 * Builds the `info` passed to type scope functions for `objectType`. Checks run from `isTypeOf` get
 * the `info` of the field returning the object, or none from graphql-jit, so the type is looked up
 * by name, falling back to the built schema.
 */
export function createTypeScopeInfo(
  objectType: string,
  getSchema: () => TypeScopeInfo['schema'],
): (info: GraphQLResolveInfo | undefined) => TypeScopeInfo {
  let cached: TypeScopeInfo | undefined;

  return (info) => {
    // Field checks run with the object's own `info`.
    if (info?.parentType.name === objectType) {
      if (cached?.parentType !== info.parentType) {
        cached = { parentType: info.parentType, schema: info.schema };
      }

      return cached;
    }

    const schema = info?.schema ?? getSchema();

    if (cached?.schema !== schema) {
      cached = {
        schema,
        parentType: schema.getType(objectType) as TypeScopeInfo['parentType'],
      };
    }

    return cached;
  };
}

// Scopes from an interface run once for each implementing object type, and their functions see
// that type, so their results are cached separately for each one.
function typeScopeCacheKey(type: string, objectType: string) {
  return type === objectType ? type : `${type}/${objectType}`;
}

export function createTypeAuthScopesStep<Types extends SchemaTypes>(
  authScopes: TypeAuthScopes<Types, unknown>,
  type: string,
  objectType: string,
  typeScopeInfo: (info: GraphQLResolveInfo | undefined) => TypeScopeInfo,
): ResolveStep<Types> {
  if (typeof authScopes === 'function') {
    const cacheKey = typeScopeCacheKey(type, objectType);

    return {
      key: typeAuthScopesStepKey(type),
      readsParent: true,
      run: (state, parent, _args, _context, info) =>
        state.evaluateTypeScopeFunction(authScopes, cacheKey, parent, info, typeScopeInfo(info)),
      errorMessage: `Not authorized to read fields for ${type}`,
    };
  }

  return {
    key: typeAuthScopesStepKey(type),
    run: (state, _parent, _args, _context, info) => state.evaluateScopeMap(authScopes, info),
    errorMessage: `Not authorized to read fields for ${type}`,
  };
}

export function createTypeGrantScopesStep<Types extends SchemaTypes>(
  grantScopes: TypeGrantScopes<Types, unknown>,
  type: string,
  objectType: string,
  typeScopeInfo: (info: GraphQLResolveInfo | undefined) => TypeScopeInfo,
  forField: boolean,
): ResolveStep<Types> {
  const cacheKey = typeScopeCacheKey(type, objectType);

  return {
    key: typeGrantScopesStepKey(type),
    readsParent: true,
    run: (state, parent, _args, context, info) =>
      state.grantTypeScopes(cacheKey, parent, forField ? info.path.prev : info.path, () =>
        grantScopes(parent, context, typeScopeInfo(info)),
      ),
    errorMessage: `Unknown error creating grants for ${type}`,
  };
}

export function createFieldAuthScopesStep<Types extends SchemaTypes>(
  authScopes: FieldAuthScopes<Types, {}, {}>,
): ResolveStep<Types> {
  if (typeof authScopes === 'function') {
    return {
      readsParent: true,
      errorMessage: (_parent, _args, _context, info) =>
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
    errorMessage: (_parent, _args, _context, info) =>
      `Not authorized to resolve ${info.parentType}.${info.fieldName}`,
    run: (state, _parent, _args, _context, info) => state.evaluateScopeMap(authScopes, info),
  };
}

export function createFieldGrantScopesStep<Types extends SchemaTypes>(
  grantScopes: FieldGrantScopes<Types, {}, {}>,
): ResolveStep<Types> {
  return {
    readsParent: typeof grantScopes === 'function',
    errorMessage: (_parent, _args, _context, info) =>
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
    errorMessage: (_parent, _args, _context, info) =>
      `Unknown issue resolving ${info.parentType}.${info.fieldName}`,
    run: (_state, parent, args, context, info, setResolved) => {
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
