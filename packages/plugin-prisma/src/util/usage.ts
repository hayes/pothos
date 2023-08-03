export const usageSymbol = Symbol.for('Pothos.isUsed');

export function wrapWithUsageCheck<T extends Object>(obj: T): T {
  const result = {};
  let used = true;

  Object.defineProperty(result, usageSymbol, {
    get() {
      return used;
    },
    enumerable: false,
  });

  for (const key of Object.keys(obj)) {
    // only set to false if the object has keys
    used = false;
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      get() {
        used = true;
        return obj[key as keyof T];
      },
    });
  }

  return result as T;
}

export function isUsed(obj: object): boolean {
  return !(usageSymbol in obj) || (obj as { [usageSymbol]: boolean })[usageSymbol];
}
