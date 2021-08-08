import { GraphQLResolveInfo } from 'graphql';
import { isThenable, MaybePromise, SchemaTypes } from '@giraphql/core';
import RequestCache from './request-cache.js';
import { AuthScopeMap, ScopeLoaderMap, TypeAuthScopesFunction } from './types.js';
import { canCache } from './util.js';

export default class ResolveState<Types extends SchemaTypes> {
  cache;

  resolveValue: unknown;

  constructor(cache: RequestCache<Types>) {
    this.cache = cache;
  }

  evaluateScopeMapWithScopes(
    { $all, $any, $granted, ...map }: AuthScopeMap<Types>,
    scopes: ScopeLoaderMap<Types>,
    info: GraphQLResolveInfo,
    forAll: boolean,
  ): MaybePromise<boolean> {
    const scopeNames = Object.keys(map) as (keyof typeof map)[];

    const loaderList: [
      keyof Types['AuthScopes'],
      Types['AuthScopes'][keyof Types['AuthScopes']],
    ][] = [];

    for (const scopeName of scopeNames) {
      if (scopes[scopeName] == null || scopes[scopeName] === false) {
        if (forAll) {
          return false;
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
      } else if (scope === !forAll) {
        return scope;
      }
    }

    const promises: Promise<boolean>[] = [];

    if ($granted) {
      const result = this.cache.testGrantedScopes($granted, info.path);

      if (result !== forAll) {
        return result;
      }
    }

    if ($any) {
      const anyResult = this.evaluateScopeMap($any, info);

      if (typeof anyResult === 'boolean') {
        if (anyResult === !forAll) {
          return anyResult;
        }
      } else {
        promises.push(anyResult);
      }
    }

    if ($all) {
      const allResult = this.evaluateScopeMap($all, info, true);

      if (typeof allResult === 'boolean') {
        if (allResult === !forAll) {
          if (promises.length > 0) {
            return Promise.all(promises).then(() => allResult);
          }

          return allResult;
        }
      } else {
        promises.push(allResult);
      }
    }

    for (const [loaderName, arg] of loaderList) {
      const result = this.cache.evaluateScopeLoader(scopes, loaderName, arg);

      if (isThenable(result)) {
        promises.push(result);
      } else if (result === !forAll) {
        if (promises.length > 0) {
          return Promise.all(promises).then(() => result);
        }

        return result;
      }
    }

    if (promises.length === 0) {
      return forAll;
    }

    return Promise.all(promises).then((results) =>
      forAll ? results.every(Boolean) : results.some(Boolean),
    );
  }

  evaluateScopeMap(
    map: AuthScopeMap<Types>,
    info: GraphQLResolveInfo,
    forAll = false,
  ): MaybePromise<boolean> {
    if (!this.cache.mapCache.has(map)) {
      const result = this.cache.withScopes((scopes) =>
        this.evaluateScopeMapWithScopes(map, scopes, info, forAll),
      );

      if (canCache(map)) {
        this.cache.mapCache.set(map, result);
      }

      return result;
    }

    return this.cache.mapCache.get(map)!;
  }

  evaluateTypeScopeFunction(
    authScopes: TypeAuthScopesFunction<Types, unknown>,
    type: string,
    parent: unknown,
    info: GraphQLResolveInfo,
  ) {
    const { typeCache } = this.cache;

    if (!typeCache.has(type)) {
      typeCache.set(type, new Map<unknown, MaybePromise<boolean>>());
    }

    const cache = typeCache.get(type)!;

    if (!cache.has(parent)) {
      const result = authScopes(parent, this.cache.context);

      if (isThenable(result)) {
        cache.set(
          parent,
          result.then((resolved) =>
            typeof resolved === 'boolean' ? resolved : this.evaluateScopeMap(resolved, info),
          ),
        );
      } else {
        cache.set(
          parent,
          typeof result === 'boolean' ? result : this.evaluateScopeMap(result, info),
        );
      }
    }

    return cache.get(parent)!;
  }
}
