export const contextCacheSymbol = Symbol.for('Pothos.contextCache');

export function initContextCache() {
  return {
    [contextCacheSymbol]: {},
  };
}

export interface ContextCache<T, C extends object, Args extends unknown[]> {
  (context: C, ...args: Args): T;
  delete: (context: C) => void;
}

export function createContextCache<T, C extends object = object, Args extends unknown[] = []>(
  create: (context: C, ...args: Args) => T,
): ContextCache<T, C, Args> {
  const cache = new WeakMap<object, T>();

  const getOrCreate = (context: C, ...args: Args) => {
    const cacheKey = (context as { [contextCacheSymbol]: object })[contextCacheSymbol] || context;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const entry = create(context, ...args);

    cache.set(cacheKey, entry);

    return entry;
  };

  getOrCreate.delete = (context: C) => {
    const cacheKey = (context as { [contextCacheSymbol]: object })[contextCacheSymbol] || context;

    cache.delete(cacheKey);
  };

  return getOrCreate;
}
