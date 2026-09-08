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

    // Keys holding `undefined` are treated as absent, so `{ where: cond ? filter : undefined }`
    // compares equal to `{}` when the condition is false. Ignored keys are skipped on both sides.
    const keys = comparedKeys(left as Record<string, unknown>, ignore);

    if (keys.length !== comparedKeys(right as Record<string, unknown>, ignore).length) {
      return false;
    }

    for (const key of keys) {
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

function comparedKeys(value: Record<string, unknown>, ignore?: Set<string>) {
  return Object.keys(value).filter((key) => value[key] !== undefined && !ignore?.has(key));
}
