/**
 * Structural equality for query arguments (`where`, `orderBy`, `take`, ...). Keys holding
 * `undefined` are treated as absent, so `{ where: cond ? filter : undefined }` compares equal to
 * `{}` when the condition is false.
 */
export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (left && right && typeof left === 'object' && typeof right === 'object') {
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right)) {
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

    if (isOpaque(left) || isOpaque(right)) {
      return opaqueEqual(left, right);
    }

    const lValue = left.valueOf?.();
    const rValue = right.valueOf?.();

    // A boxed value (a Date, a boxed primitive) compares by its primitive, whichever side it is
    // on: a plain object's `valueOf` returns the object itself, and a null-prototype object has
    // none at all, so neither is mistaken for one.
    if (
      (lValue != null && typeof lValue !== 'object') ||
      (rValue != null && typeof rValue !== 'object')
    ) {
      return lValue === rValue;
    }

    const keys = comparedKeys(left as Record<string, unknown>);

    if (keys.length !== comparedKeys(right as Record<string, unknown>).length) {
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

/**
 * A class instance with no enumerable state and no primitive value (a Temporal value, or a class
 * using private fields) can't be compared structurally: every instance would look identical, and
 * Temporal's `valueOf` throws.
 */
function isOpaque(value: object) {
  const proto = Object.getPrototypeOf(value);

  if (
    proto === null ||
    proto === Object.prototype ||
    ArrayBuffer.isView(value) ||
    Object.keys(value).length > 0
  ) {
    return false;
  }

  try {
    const primitive = value.valueOf();
    return primitive == null || typeof primitive === 'object';
  } catch {
    return true;
  }
}

function opaqueEqual(left: object, right: object) {
  const { equals } = left as { equals?: unknown };

  if (typeof equals !== 'function') {
    return false;
  }

  try {
    return equals.call(left, right) === true;
  } catch {
    return false;
  }
}

function comparedKeys(value: Record<string, unknown>) {
  return Object.keys(value).filter((key) => value[key] !== undefined);
}
