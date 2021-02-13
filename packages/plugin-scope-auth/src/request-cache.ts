import { GraphQLResolveInfo } from 'graphql';
import { Path } from 'graphql/jsutils/Path';
import { isThenable, MaybePromise, SchemaTypes } from '@giraphql/core';
import { ScopeLoaderMap } from './types';
import { cacheKey } from './util';
import ScopeAuthPlugin from '.';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requestCache = new WeakMap<{}, RequestCache<any>>();

export default class RequestCache<Types extends SchemaTypes> {
  plugin;

  context;

  mapCache = new Map<{}, MaybePromise<boolean>>();

  scopeCache = new Map<keyof Types['AuthScopes'], Map<unknown, MaybePromise<boolean>>>();

  typeCache = new Map<string, Map<unknown, MaybePromise<boolean>>>();

  typeGrants = new Map<string, Map<unknown, MaybePromise<boolean>>>();

  grantCache = new Map<string, Set<string>>();

  scopes?: MaybePromise<ScopeLoaderMap<Types>>;

  constructor(plugin: ScopeAuthPlugin<Types>, context: Types['Context']) {
    this.plugin = plugin;
    this.context = context;
  }

  static fromContext<Types extends SchemaTypes>(
    context: Types['Context'],
    plugin: ScopeAuthPlugin<Types>,
  ): RequestCache<Types> {
    if (!requestCache.has(context)) {
      requestCache.set(context, new RequestCache<Types>(plugin, context));
    }

    return requestCache.get(context)!;
  }

  getScopes(): MaybePromise<ScopeLoaderMap<Types>> {
    if (!this.scopes) {
      const scopes = this.plugin.builder.options.authScopes(this.context);

      if (isThenable(scopes)) {
        this.scopes = scopes.then((resolved) => {
          this.scopes = resolved;

          return resolved;
        });
      } else {
        this.scopes = scopes;
      }
    }

    return this.scopes;
  }

  withScopes<T>(cb: (scopes: ScopeLoaderMap<Types>) => MaybePromise<T>): MaybePromise<T> {
    const scopes = this.getScopes();

    if (isThenable(scopes)) {
      // eslint-disable-next-line promise/no-callback-in-promise
      return scopes.then((resolvedScopes) => cb(resolvedScopes));
    }

    return cb(scopes);
  }

  saveGrantedScopes(scopes: string[], path: Path | undefined) {
    const key = cacheKey(path);

    if (this.grantCache.has(key)) {
      const set = this.grantCache.get!(key)!;

      scopes.forEach((scope) => set.add(scope));
    } else {
      this.grantCache.set(key, new Set(scopes));
    }

    return true;
  }

  testGrantedScopes(scope: string, path: Path) {
    if (this.grantCache.get(cacheKey(path.prev))?.has(scope)) {
      return true;
    } else if (
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
    info: GraphQLResolveInfo,
    cb: () => MaybePromise<string[]>,
  ) {
    if (!this.typeGrants.has(type)) {
      this.typeGrants.set(type, new Map());
    }

    const cache = this.typeGrants.get(type)!;

    if (!cache.has(parent)) {
      const result = cb();

      if (isThenable(result)) {
        cache.set(
          parent,
          result.then((resolved) => this.saveGrantedScopes(resolved, info.path.prev)),
        );
      } else {
        cache.set(parent, this.saveGrantedScopes(result, info.path.prev));
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

    if (!cache.has(arg)) {
      const loader = scopes[name];

      if (typeof loader !== 'function') {
        throw new TypeError(
          `Attempted to evaluate scope ${name} as scope loader, but it is not a function`,
        );
      }

      cache.set(arg, (loader as (param: Types['AuthScopes'][T]) => MaybePromise<boolean>)(arg));
    }

    return cache.get(arg)!;
  }
}
