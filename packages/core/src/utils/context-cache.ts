export const contextCacheSymbol = Symbol.for('Pothos.contextCache');

export function initContextCache() {
  return {
    [contextCacheSymbol]: {},
  };
}

export type ContextCache<T, C extends object, Args extends unknown[]> = (
  context: C,
  ...args: Args
) => T;

export function createContextCache<T, C extends object = object, Args extends unknown[] = []>(
  create: (context: C, ...args: Args) => T,
): ContextCache<T, C, Args> {
  const cache = new WeakMap<object, T>();

  return (context, ...args) => {
    const cacheKey = (context as { [contextCacheSymbol]: object })[contextCacheSymbol] || context;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const entry = create(context, ...args);

    cache.set(cacheKey, entry);

    return entry;
  };
}
