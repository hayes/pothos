export const usageSymbol = Symbol.for('Pothos.isUsed');

export function wrapWithUsageCheck<T extends object>(obj: T): T {
  const result = {};
  let used = true;

  Object.defineProperty(result, usageSymbol, {
    get() {
      return used;
    },
    set(value: boolean) {
      used = value;
    },
    enumerable: false,
  });

  for (const key of Object.keys(obj)) {
    // only set to false if the object has keys
    used = false;
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
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

export function extendWithUsage<T extends object, U extends object>(
  original: T,
  extension: U,
): T & U {
  if (!(usageSymbol in original)) {
    return { ...original, ...extension };
  }

  const result = { ...extension };

  for (const key of [usageSymbol, ...Object.keys(original)]) {
    if (key in result) {
      continue;
    }

    Object.defineProperty(result, key, {
      enumerable: key !== usageSymbol,
      configurable: key !== usageSymbol,
      get() {
        return original[key as keyof T];
      },
    });
  }

  return result as T & U;
}
