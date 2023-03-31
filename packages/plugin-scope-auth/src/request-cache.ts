/* eslint-disable @typescript-eslint/promise-function-async */
import { GraphQLResolveInfo } from 'graphql';
import {
  createContextCache,
  isThenable,
  MaybePromise,
  Path,
  PothosValidationError,
  SchemaTypes,
} from '@pothos/core';
import {
  AuthFailure,
  AuthScopeFailureType,
  AuthScopeMap,
  ScopeLoaderMap,
  TypeAuthScopesFunction,
} from './types';
import { cacheKey, canCache } from './util';

const contextCache = createContextCache(
  (ctx, builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) => new RequestCache(builder, ctx),
);

export default class RequestCache<Types extends SchemaTypes> {
  builder;

  context;

  mapCache = new Map<{}, MaybePromise<AuthFailure | null>>();

  scopeCache = new Map<keyof Types['AuthScopes'], Map<unknown, MaybePromise<AuthFailure | null>>>();

  typeCache = new Map<string, Map<unknown, MaybePromise<AuthFailure | null>>>();

  typeGrants = new Map<string, Map<unknown, MaybePromise<null>>>();

  grantCache = new Map<string, Set<string>>();

  scopes?: MaybePromise<ScopeLoaderMap<Types>>;

  cacheKey?: (value: unknown) => unknown;

  treatErrorsAsUnauthorized: boolean;

  defaultStrategy: 'all' | 'any';

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, context: Types['Context']) {
    this.builder = builder;
    this.context = context;
    this.cacheKey = builder.options.scopeAuth?.cacheKey;
    this.treatErrorsAsUnauthorized = builder.options.scopeAuth?.treatErrorsAsUnauthorized ?? false;
    this.defaultStrategy = builder.options.scopeAuth?.defaultStrategy ?? 'any';
  }

  static fromContext<T extends SchemaTypes>(
    context: T['Context'],
    builder: PothosSchemaTypes.SchemaBuilder<T>,
  ): RequestCache<T> {
    return contextCache(context, builder as never) as never;
  }

  static clearForContext<T extends SchemaTypes>(context: T['Context']): void {
    contextCache.delete(context);
  }

  getScopes(): MaybePromise<ScopeLoaderMap<Types>> {
    if (!this.scopes) {
      const scopes = this.builder.options.scopeAuth.authScopes(this.context);

      this.scopes = isThenable(scopes)
        ? scopes.then((resolved) => {
            this.scopes = resolved;

            return resolved;
          })
        : scopes;
    }

    return this.scopes;
  }

  withScopes<T>(cb: (scopes: ScopeLoaderMap<Types>) => MaybePromise<T>): MaybePromise<T> {
    const scopes = this.getScopes();

    if (isThenable(scopes)) {
      return scopes.then((resolvedScopes) => cb(resolvedScopes));
    }

    return cb(scopes);
  }

  saveGrantedScopes(scopes: readonly string[], path: Path | undefined) {
    const key = cacheKey(path);

    if (this.grantCache.has(key)) {
      const set = this.grantCache.get(key)!;

      scopes.forEach((scope) => set.add(scope));
    } else {
      this.grantCache.set(key, new Set(scopes));
    }

    return null;
  }

  testGrantedScopes(scope: string, path: Path) {
    if (this.grantCache.get(cacheKey(path.prev))?.has(scope)) {
      return true;
    }
    if (
      typeof path.prev?.key === 'number' &&
      this.grantCache.get(cacheKey(path.prev.prev))?.has(scope)
    ) {
      return true;
    }

    return false;
  }

  grantTypeScopes(
    type: string,
    parent: unknown,
    path: Path | undefined,
    cb: () => MaybePromise<readonly string[]>,
  ) {
    if (!this.typeGrants.has(type)) {
      this.typeGrants.set(type, new Map<string, Promise<null>>());
    }

    const cache = this.typeGrants.get(type)!;

    if (!cache.has(parent)) {
      const result = cb();

      if (isThenable(result)) {
        cache.set(
          parent,
          result.then((resolved) => this.saveGrantedScopes(resolved, path)),
        );
      } else {
        cache.set(parent, this.saveGrantedScopes(result, path));
      }
    }

    return cache.get(parent)!;
  }

  evaluateScopeLoader<T extends keyof Types['AuthScopes']>(
    scopes: ScopeLoaderMap<Types>,
    name: T,
    arg: Types['AuthScopes'][T],
  ) {
    if (!this.scopeCache.has(name)) {
      this.scopeCache.set(name, new Map());
    }

    const cache = this.scopeCache.get(name)!;
    const key = this.cacheKey ? this.cacheKey(arg) : arg;

    if (!cache.has(key)) {
      const loader = scopes[name];

      if (typeof loader !== 'function') {
        throw new PothosValidationError(
          `Attempted to evaluate scope ${String(name)} as scope loader, but it is not a function`,
        );
      }

      let result;

      if (this.treatErrorsAsUnauthorized) {
        try {
          result = (loader as (param: Types['AuthScopes'][T]) => MaybePromise<boolean>)(arg);
        } catch (error: unknown) {
          cache.set(key, {
            kind: AuthScopeFailureType.AuthScope,
            scope: name as string,
            parameter: arg,
            error: error as Error,
          });

          return cache.get(key)!;
        }
      } else {
        result = (loader as (param: Types['AuthScopes'][T]) => MaybePromise<boolean>)(arg);
      }

      if (isThenable(result)) {
        let promise: Promise<AuthFailure | null> = result.then((r) =>
          r
            ? null
            : {
                kind: AuthScopeFailureType.AuthScope,
                scope: name as string,
                parameter: arg,
                error: null,
              },
        );

        if (this.treatErrorsAsUnauthorized) {
          promise = promise.catch((error: unknown) => ({
            kind: AuthScopeFailureType.AuthScope,
            scope: name as string,
            parameter: arg,
            error: error as Error,
          }));
        }

        cache.set(key, promise);
      } else {
        cache.set(
          key,
          result
            ? null
            : {
                kind: AuthScopeFailureType.AuthScope,
                scope: name as string,
                parameter: arg,
                error: null,
              },
        );
      }
    }

    return cache.get(key)!;
  }

  evaluateScopeMapWithScopes(
    { $all, $any, $granted, ...map }: AuthScopeMap<Types>,
    scopes: ScopeLoaderMap<Types>,
    info: GraphQLResolveInfo | undefined,
    forAll: boolean,
  ): MaybePromise<AuthFailure | null> {
    const scopeNames = Object.keys(map) as (keyof typeof map)[];
    const problems: AuthFailure[] = [];
    const failure: AuthFailure = {
      kind: forAll ? AuthScopeFailureType.AllAuthScopes : AuthScopeFailureType.AnyAuthScopes,
      failures: problems,
    };

    const loaderList: [
      keyof Types['AuthScopes'],
      Types['AuthScopes'][keyof Types['AuthScopes']],
    ][] = [];

    for (const scopeName of scopeNames) {
      if (scopes[scopeName] == null || scopes[scopeName] === false) {
        problems.push({
          kind: AuthScopeFailureType.AuthScope,
          scope: scopeName as string,
          parameter: map[scopeName],
          error: null,
        });
        if (forAll) {
          return failure;
        }
        // eslint-disable-next-line no-continue
        continue;
      }

      const scope:
        | boolean
        | ((arg: Types['AuthScopes'][typeof scopeName]) => MaybePromise<boolean>) =
        scopes[scopeName];

      if (typeof scope === 'function') {
        loaderList.push([scopeName, map[scopeName]]);
      } else if (scope && !forAll) {
        return null;
      } else if (!scope) {
        problems.push({
          kind: AuthScopeFailureType.AuthScope,
          scope: scopeName as string,
          parameter: map[scopeName],
          error: null,
        });

        if (forAll) {
          return failure;
        }
      }
    }

    const promises: Promise<AuthFailure | null>[] = [];

    if ($granted) {
      const result = !!info && this.testGrantedScopes($granted, info.path);

      if (result && !forAll) {
        return null;
      }

      if (!result) {
        problems.push({
          kind: AuthScopeFailureType.GrantedScope,
          scope: $granted,
        });

        if (forAll) {
          return failure;
        }
      }
    }

    if ($any) {
      const anyResult = this.evaluateScopeMap($any, info, false);

      if (isThenable(anyResult)) {
        promises.push(anyResult);
      } else if (anyResult === null && !forAll) {
        return null;
      } else if (anyResult) {
        problems.push(anyResult);

        if (forAll) {
          return failure;
        }
      }
    }

    if ($all) {
      const allResult = this.evaluateScopeMap($all, info, true);

      if (isThenable(allResult)) {
        promises.push(allResult);
      } else if (allResult === null && !forAll) {
        return resolveAndReturn(null);
      } else if (allResult) {
        problems.push(allResult);

        if (forAll) {
          return resolveAndReturn(failure);
        }
      }
    }

    for (const [loaderName, arg] of loaderList) {
      const result = this.evaluateScopeLoader(scopes, loaderName, arg);

      if (isThenable(result)) {
        promises.push(result);
      } else if (result === null && !forAll) {
        return resolveAndReturn(null);
      } else if (result) {
        problems.push(result);

        if (forAll) {
          return resolveAndReturn(failure);
        }
      }
    }

    if (promises.length === 0) {
      return forAll && problems.length === 0 ? null : failure;
    }

    return Promise.all(promises).then((results) => {
      let hasSuccess = false;
      results.forEach((result) => {
        if (result) {
          problems.push(result);
        } else {
          hasSuccess = true;
        }
      });

      if (forAll) {
        return problems.length > 0 ? failure : null;
      }

      return hasSuccess ? null : failure;
    });

    function resolveAndReturn(val: AuthFailure | null) {
      if (promises.length > 0) {
        return Promise.all(promises).then(() => val);
      }

      return val;
    }
  }

  evaluateScopeMap(
    map: AuthScopeMap<Types> | boolean,
    info?: GraphQLResolveInfo,
    forAll = this.defaultStrategy === 'all',
  ): MaybePromise<AuthFailure | null> {
    if (typeof map === 'boolean') {
      return map
        ? null
        : {
            kind: AuthScopeFailureType.AuthScopeFunction,
            error: null,
          };
    }

    if (!this.mapCache.has(map)) {
      const result = this.withScopes((scopes) =>
        this.evaluateScopeMapWithScopes(map, scopes, info, forAll),
      );

      if (canCache(map)) {
        this.mapCache.set(map, result);
      }

      return result;
    }

    return this.mapCache.get(map)!;
  }

  evaluateTypeScopeFunction(
    authScopes: TypeAuthScopesFunction<Types, unknown>,
    type: string,
    parent: unknown,
    info: GraphQLResolveInfo,
  ) {
    const { typeCache } = this;

    if (!typeCache.has(type)) {
      typeCache.set(type, new Map());
    }

    const cache = typeCache.get(type)!;

    if (!cache.has(parent)) {
      let result;

      if (this.treatErrorsAsUnauthorized) {
        try {
          result = authScopes(parent, this.context);
        } catch (error: unknown) {
          cache.set(parent, {
            kind: AuthScopeFailureType.AuthScopeFunction,
            error: error as Error,
          });

          return cache.get(parent)!;
        }
      } else {
        result = authScopes(parent, this.context);
      }

      if (isThenable(result)) {
        let promise: Promise<AuthFailure | null> = result.then((resolved) =>
          this.evaluateScopeMap(resolved, info),
        );

        if (this.treatErrorsAsUnauthorized) {
          promise = promise.catch((error: unknown) => ({
            kind: AuthScopeFailureType.AuthScopeFunction,
            error: error as Error,
          }));
        }

        cache.set(parent, promise);
      } else {
        cache.set(parent, this.evaluateScopeMap(result, info));
      }
    }

    return cache.get(parent)!;
  }
}
