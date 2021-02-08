import { isThenable, MaybePromise, SchemaTypes } from '@giraphql/core';
import ScopeAuthPlugin from '.';
import { ScopeLoaderMap } from './types';

const requestCache = new WeakMap<{}, RequestCache<any>>();

export default class RequestCache<Types extends SchemaTypes> {
  plugin;

  context;

  mapCache = new Map<{}, MaybePromise<boolean>>();

  scopeCache = new Map<keyof Types['AuthScopes'], Map<unknown, MaybePromise<boolean>>>();

  typeCache = new Map<string, Map<unknown, MaybePromise<boolean>>>();

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
