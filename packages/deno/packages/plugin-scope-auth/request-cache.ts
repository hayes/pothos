// @ts-nocheck
/* eslint-disable @typescript-eslint/promise-function-async */
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { isThenable, MaybePromise, Path, SchemaTypes } from '../core/index.ts';
import { ScopeLoaderMap } from './types.ts';
import { cacheKey } from './util.ts';
import { AuthFailure, AuthScopeFailureType, PothosScopeAuthPlugin } from './index.ts';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requestCache = new WeakMap<{}, RequestCache<any>>();
export default class RequestCache<Types extends SchemaTypes> {
    plugin;
    context;
    mapCache = new Map<{}, MaybePromise<null | AuthFailure>>();
    scopeCache = new Map<keyof Types["AuthScopes"], Map<unknown, MaybePromise<AuthFailure | null>>>();
    typeCache = new Map<string, Map<unknown, MaybePromise<null | AuthFailure>>>();
    typeGrants = new Map<string, Map<unknown, MaybePromise<null>>>();
    grantCache = new Map<string, Set<string>>();
    scopes?: MaybePromise<ScopeLoaderMap<Types>>;
    cacheKey?: (value: unknown) => unknown;
    constructor(plugin: PothosScopeAuthPlugin<Types>, context: Types["Context"]) {
        this.plugin = plugin;
        this.context = context;
        this.cacheKey = plugin.builder.options.scopeAuthOptions?.cacheKey;
    }
    static fromContext<T extends SchemaTypes>(context: T["Context"], plugin: PothosScopeAuthPlugin<T>): RequestCache<T> {
        if (!requestCache.has(context)) {
            requestCache.set(context, new RequestCache<T>(plugin, context));
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return requestCache.get(context)!;
    }
    getScopes(): MaybePromise<ScopeLoaderMap<Types>> {
        if (!this.scopes) {
            const scopes = this.plugin.builder.options.authScopes(this.context);
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
    saveGrantedScopes(scopes: string[], path: Path | undefined) {
        const key = cacheKey(path);
        if (this.grantCache.has(key)) {
            const set = this.grantCache.get(key)!;
            scopes.forEach((scope) => set.add(scope));
        }
        else {
            this.grantCache.set(key, new Set(scopes));
        }
        return null;
    }
    testGrantedScopes(scope: string, path: Path) {
        if (this.grantCache.get(cacheKey(path.prev))?.has(scope)) {
            return true;
        }
        if (typeof path.prev?.key === "number" &&
            this.grantCache.get(cacheKey(path.prev.prev))?.has(scope)) {
            return true;
        }
        return false;
    }
    grantTypeScopes(type: string, parent: unknown, info: GraphQLResolveInfo, cb: () => MaybePromise<string[]>) {
        if (!this.typeGrants.has(type)) {
            this.typeGrants.set(type, new Map<string, Promise<null>>());
        }
        const cache = this.typeGrants.get(type)!;
        if (!cache.has(parent)) {
            const result = cb();
            if (isThenable(result)) {
                cache.set(parent, result.then((resolved) => this.saveGrantedScopes(resolved, info.path.prev)));
            }
            else {
                cache.set(parent, this.saveGrantedScopes(result, info.path.prev));
            }
        }
        return cache.get(parent)!;
    }
    evaluateScopeLoader<T extends keyof Types["AuthScopes"]>(scopes: ScopeLoaderMap<Types>, name: T, arg: Types["AuthScopes"][T]) {
        if (!this.scopeCache.has(name)) {
            this.scopeCache.set(name, new Map());
        }
        const cache = this.scopeCache.get(name)!;
        const key = this.cacheKey ? this.cacheKey(arg) : arg;
        if (!cache.has(key)) {
            const loader = scopes[name];
            if (typeof loader !== "function") {
                throw new TypeError(`Attempted to evaluate scope ${name} as scope loader, but it is not a function`);
            }
            const result = (loader as (param: Types["AuthScopes"][T]) => MaybePromise<boolean>)(arg);
            if (isThenable(result)) {
                cache.set(key, result.then((r) => r
                    ? null
                    : {
                        kind: AuthScopeFailureType.AuthScope,
                        scope: name as string,
                        parameter: arg,
                    }));
            }
            else {
                cache.set(key, result
                    ? null
                    : {
                        kind: AuthScopeFailureType.AuthScope,
                        scope: name as string,
                        parameter: arg,
                    });
            }
        }
        return cache.get(key)!;
    }
}
