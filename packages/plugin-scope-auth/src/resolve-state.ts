import { isThenable, MaybePromise, SchemaTypes } from '@giraphql/core';
import { AuthScopeMap, ScopeLoaderMap, TypeAuthScopesFunction } from './types';
import RequestCache from './request-cache';

export default class ResolveState<Types extends SchemaTypes> {
  cache;

  resolveValue: unknown;

  constructor(cache: RequestCache<Types>) {
    this.cache = cache;
  }

  static evaluateScopeMap<Types extends SchemaTypes>(
    map: AuthScopeMap<Types>,
    scopes: ScopeLoaderMap<Types>,
    cache: RequestCache<Types>,
  ): MaybePromise<boolean> {
    const scopeNames: (keyof Types['AuthScopes'])[] = Object.keys(
      map,
    ) as (keyof Types['AuthScopes'])[];

    const loaderList: [
      keyof Types['AuthScopes'],
      Types['AuthScopes'][keyof Types['AuthScopes']],
    ][] = [];

    for (const scopeName of scopeNames) {
      if (scopes[scopeName] == null || scopes[scopeName] === false) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const scope:
        | boolean
        | ((arg: Types['AuthScopes'][typeof scopeName]) => MaybePromise<boolean>) =
        scopes[scopeName];

      if (typeof scope === 'function') {
        loaderList.push([scopeName, map[scopeName]]);
      } else if (scope === true) {
        return true;
      }
    }

    const promises: Promise<boolean>[] = [];
    let hasSuccess = false;

    loaderList.forEach(([loaderName, arg]) => {
      const result = cache.evaluateScopeLoader(scopes, loaderName, arg);

      if (isThenable(result)) {
        promises.push(result);
      } else if (result === true) {
        hasSuccess = true;
      }
    });

    if (promises.length === 0) {
      return hasSuccess;
    }

    return Promise.all(promises).then((results) => !!results.find(Boolean));
  }

  evaluateScopeMap(map: AuthScopeMap<Types>): MaybePromise<boolean> {
    if (!this.cache.mapCache.has(map)) {
      this.cache.mapCache.set(
        map,
        this.cache.withScopes((scopes) => ResolveState.evaluateScopeMap(map, scopes, this.cache)),
      );
    }

    return this.cache.mapCache.get(map)!;
  }

  evaluateTypeScopeFunction(
    authScopes: TypeAuthScopesFunction<Types, unknown>,
    type: string,
    parent: unknown,
  ) {
    const { typeCache } = this.cache;

    if (!typeCache.has(type)) {
      typeCache.set(type, new Map());
    }

    const cache = typeCache.get(type)!;

    if (!cache.has(parent)) {
      const result = authScopes(parent, this.cache.context);

      if (isThenable(result)) {
        cache.set(
          parent,
          result.then((resolved) =>
            typeof resolved === 'boolean' ? resolved : this.evaluateScopeMap(resolved),
          ),
        );
      } else {
        cache.set(parent, typeof result === 'boolean' ? result : this.evaluateScopeMap(result));
      }
    }

    return cache.get(parent)!;
  }
}
