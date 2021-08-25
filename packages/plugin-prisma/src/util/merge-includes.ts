/* eslint-disable no-continue */
export function deepEqual(left: unknown, right: unknown, ignore?: Set<string>) {
  if (left === right) {
    return true;
  }

  if (left && right && typeof left === 'object' && typeof right === 'object') {
    if (Array.isArray(left)) {
      if (!Array.isArray(right)) {
        return false;
      }

      const { length } = left;

      if (right.length !== length) {
        return false;
      }

      for (let i = 0; i < length; i += 1) {
        if (!deepEqual(left[i], right[i])) {
          return false;
        }
      }

      return true;
    }

    const keys = Object.keys(left);
    const keyLength = keys.length;

    if (keyLength !== Object.keys(right).length) {
      return false;
    }

    for (const key of keys) {
      if (ignore?.has(key)) {
        continue;
      }

      if (
        !deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])
      ) {
        return false;
      }
    }

    return true;
  }

  return false;
}

const ignoreInclude = new Set(['include']);

export function mergeIncludes(
  existing: Record<string, unknown> | boolean,
  newQuery: Record<string, unknown> | boolean,
): Record<string, unknown> | boolean {
  if (!deepEqual(existing, newQuery, ignoreInclude)) {
    return false;
  }

  if (!existing) {
    return newQuery;
  }

  if (newQuery === true) {
    return existing;
  }

  if (existing === true) {
    return newQuery || existing;
  }

  if (!newQuery) {
    return existing;
  }

  if (!existing.include) {
    return { ...existing, include: newQuery.include };
  }

  if (!newQuery.include) {
    return existing;
  }

  const merged: Record<string, unknown> = {
    ...(existing.include as object),
  };

  const newInclude = newQuery.include as Record<string, unknown>;
  const keys = Object.keys(newQuery.include as object);

  for (const key of keys) {
    const current = merged[key];
    const newVal = newInclude[key];

    if (!current) {
      merged[key] = newVal;
    } else if (typeof newVal === 'boolean') {
      continue;
    } else if (merged[key] === true) {
      if (newVal) {
        merged[key] = newVal;
      }
    } else if (typeof current === 'object' && typeof newVal === 'object' && current && newVal) {
      const mergedVal = mergeIncludes(
        current as Record<string, unknown>,
        newVal as Record<string, unknown>,
      );

      if (!mergedVal) {
        return false;
      }

      merged[key] = mergedVal;
    }
  }

  return { ...existing, include: merged };
}
