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

    const lValue = left.valueOf?.();
    const rValue = right.valueOf?.();

    if ((lValue != null || rValue != null) && typeof lValue !== 'object') {
      return lValue === rValue;
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
