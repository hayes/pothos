// @ts-nocheck
export const contextCacheSymbol = Symbol.for("GiraphQL.contextCache");
export function initContextCache() {
    return {
        [contextCacheSymbol]: {},
    };
}
export function createContextCache<T, C extends object>(create: (context: C) => T) {
    const cache = new WeakMap<object, T>();
    return (context: C) => {
        const cacheKey = (context as {
            [contextCacheSymbol]: object;
        })[contextCacheSymbol] || context;
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey)!;
        }
        const entry = create(context);
        cache.set(cacheKey, entry);
        return entry;
    };
}
