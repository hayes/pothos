/**
 * Structural equality for query arguments (`where`, `orderBy`, `take`, ...). Keys holding
 * `undefined` are treated as absent, so `{ where: cond ? filter : undefined }` compares equal to
 * `{}` when the condition is false.
 */
export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (!(left && right && typeof left === 'object' && typeof right === 'object')) {
    return false;
  }

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

  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    return viewsEqual(left, right);
  }

  const leftOpaque = isOpaque(left);
  const rightOpaque = isOpaque(right);

  if (leftOpaque || rightOpaque) {
    return leftOpaque && rightOpaque && opaqueEqual(left, right);
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

/** Typed arrays and DataViews compare byte for byte, and only with a view of the same type. */
function viewsEqual(left: object, right: object) {
  if (
    !ArrayBuffer.isView(left) ||
    !ArrayBuffer.isView(right) ||
    Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) ||
    left.byteLength !== right.byteLength
  ) {
    return false;
  }

  const lBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
  const rBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);

  for (let i = 0; i < lBytes.length; i += 1) {
    if (lBytes[i] !== rBytes[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Whether `value` is an instance with no enumerable state and no primitive value, such as a
 * Temporal value or a `Map`. Such instances would all compare equal structurally, and Temporal's
 * `valueOf` throws.
 */
function isOpaque(value: object) {
  const proto = Object.getPrototypeOf(value);

  if (proto === null || proto === Object.prototype || Object.keys(value).length > 0) {
    return false;
  }

  try {
    const primitive = value.valueOf();
    return primitive == null || typeof primitive === 'object';
  } catch {
    return true;
  }
}

/**
 * Two distinct opaque values are equal only when they share a prototype and `left.equals` says so.
 * Without an `equals` they compare by identity. The shared prototype keeps the comparison
 * symmetric, since Temporal's `equals` also accepts property bags and strings.
 */
function opaqueEqual(left: object, right: object) {
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
    return false;
  }

  const { equals } = left as { equals?: unknown };

  if (typeof equals !== 'function') {
    return false;
  }

  return equals.call(left, right) === true;
}

function comparedKeys(value: Record<string, unknown>) {
  return Object.keys(value).filter((key) => value[key] !== undefined);
}
