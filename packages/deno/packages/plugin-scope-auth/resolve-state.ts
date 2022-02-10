// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { isThenable, MaybePromise, SchemaTypes } from '../core/index.ts';
import RequestCache from './request-cache.ts';
import { AuthScopeMap, ScopeLoaderMap, TypeAuthScopesFunction } from './types.ts';
import { canCache } from './util.ts';
import { AuthFailure, AuthScopeFailureType } from './index.ts';
export default class ResolveState<Types extends SchemaTypes> {
    cache;
    resolveValue: unknown;
    constructor(cache: RequestCache<Types>) {
        this.cache = cache;
    }
    evaluateScopeMapWithScopes({ $all, $any, $granted, ...map }: AuthScopeMap<Types>, scopes: ScopeLoaderMap<Types>, info: GraphQLResolveInfo, forAll: boolean): MaybePromise<null | AuthFailure> {
        const scopeNames = Object.keys(map) as (keyof typeof map)[];
        const problems: AuthFailure[] = [];
        const failure: AuthFailure = {
            kind: forAll ? AuthScopeFailureType.AllAuthScopes : AuthScopeFailureType.AnyAuthScopes,
            failures: problems,
        };
        const loaderList: [
            keyof Types["AuthScopes"],
            Types["AuthScopes"][keyof Types["AuthScopes"]]
        ][] = [];
        for (const scopeName of scopeNames) {
            if (scopes[scopeName] == null || scopes[scopeName] === false) {
                problems.push({
                    kind: AuthScopeFailureType.AuthScope,
                    scope: scopeName as string,
                    parameter: map[scopeName],
                });
                if (forAll) {
                    return failure;
                }
                // eslint-disable-next-line no-continue
                continue;
            }
            const scope: boolean | ((arg: Types["AuthScopes"][typeof scopeName]) => MaybePromise<boolean>) = scopes[scopeName];
            if (typeof scope === "function") {
                loaderList.push([scopeName, map[scopeName]]);
            }
            else if (scope && !forAll) {
                return null;
            }
            else if (!scope) {
                problems.push({
                    kind: AuthScopeFailureType.AuthScope,
                    scope: scopeName as string,
                    parameter: map[scopeName],
                });
                if (forAll) {
                    return failure;
                }
            }
        }
        const promises: Promise<null | AuthFailure>[] = [];
        if ($granted) {
            const result = this.cache.testGrantedScopes($granted, info.path);
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
            const anyResult = this.evaluateScopeMap($any!, info);
            if (isThenable(anyResult)) {
                promises.push(anyResult);
            }
            else if (anyResult === null && !forAll) {
                return null;
            }
            else if (anyResult) {
                problems.push(anyResult);
                if (forAll) {
                    return failure;
                }
            }
        }
        if ($all) {
            const allResult = this.evaluateScopeMap($all!, info, true);
            if (isThenable(allResult)) {
                promises.push(allResult);
            }
            else if (allResult === null && !forAll) {
                return resolveAndReturn(null);
            }
            else if (allResult) {
                problems.push(allResult);
                if (forAll) {
                    return resolveAndReturn(failure);
                }
            }
        }
        for (const [loaderName, arg] of loaderList) {
            const result = this.cache.evaluateScopeLoader(scopes, loaderName, arg);
            if (isThenable(result)) {
                promises.push(result);
            }
            else if (result === null && !forAll) {
                return resolveAndReturn(null);
            }
            else if (result) {
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
                }
                else {
                    hasSuccess = true;
                }
            });
            if (forAll) {
                return problems.length > 0 ? failure : null;
            }
            return hasSuccess ? null : failure;
        });
        function resolveAndReturn(val: null | AuthFailure) {
            if (promises.length > 0) {
                return Promise.all(promises).then(() => val);
            }
            return val;
        }
    }
    evaluateScopeMap(map: AuthScopeMap<Types> | boolean, info: GraphQLResolveInfo, forAll = false): MaybePromise<null | AuthFailure> {
        if (typeof map === "boolean") {
            return map
                ? null
                : {
                    kind: AuthScopeFailureType.AuthScopeFunction,
                };
        }
        if (!this.cache.mapCache.has(map)) {
            const result = this.cache.withScopes((scopes) => this.evaluateScopeMapWithScopes(map, scopes, info, forAll));
            if (canCache(map)) {
                this.cache.mapCache.set(map, result);
            }
            return result;
        }
        return this.cache.mapCache.get(map)!;
    }
    evaluateTypeScopeFunction(authScopes: TypeAuthScopesFunction<Types, unknown>, type: string, parent: unknown, info: GraphQLResolveInfo) {
        const { typeCache } = this.cache;
        if (!typeCache.has(type)) {
            typeCache.set(type, new Map());
        }
        const cache = typeCache.get(type)!;
        if (!cache.has(parent)) {
            const result = authScopes(parent, this.cache.context);
            if (isThenable(result)) {
                cache.set(parent, result.then((resolved) => this.evaluateScopeMap(resolved, info)));
            }
            else {
                cache.set(parent, this.evaluateScopeMap(result, info));
            }
        }
        return cache.get(parent)!;
    }
}
