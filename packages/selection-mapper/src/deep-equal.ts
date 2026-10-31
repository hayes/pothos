/**
 * Structural equality for query arguments (`where`, `orderBy`, `take`, ...). Keys holding
 * `undefined` are treated as absent, so `{ where: cond ? filter : undefined }` compares equal to
 * `{}` when the condition is false.
 */
export function deepEqual(left: unknown, right: unknown): boolean {
  return equal(left, right, undefined);
}

/**
 * The pairs of objects being compared on the path from the root, so a cyclic value compares
 * equal where the same pair comes round again instead of recursing forever.
 */
interface Ancestors {
  left: object;
  right: object;
  parent: Ancestors | undefined;
}

function equal(left: unknown, right: unknown, ancestors: Ancestors | undefined): boolean {
  if (left === right) {
    return true;
  }

  if (!(left && right && typeof left === 'object' && typeof right === 'object')) {
    return false;
  }

  for (let pair = ancestors; pair; pair = pair.parent) {
    if (pair.left === left && pair.right === right) {
      return true;
    }
  }

  const path: Ancestors = { left, right, parent: ancestors };

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    const { length } = left;

    if (right.length !== length) {
      return false;
    }

    for (let i = 0; i < length; i += 1) {
      if (!equal(left[i], right[i], path)) {
        return false;
      }
    }

    return true;
  }

  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    return viewsEqual(left, right);
  }

  const leftOpaque = isOpaque(left);

  if (leftOpaque || isOpaque(right)) {
    return leftOpaque && opaqueEqual(left, right);
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
      !equal((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], path)
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
 * Instances with no enumerable state or primitive value (Temporal values, private fields) would
 * all compare equal structurally, and Temporal's `valueOf` throws.
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
 * An opaque `left` equals `right` only when `right` is opaque too, shares its prototype, and
 * `left.equals` says so. The shared prototype keeps the comparison symmetric: an `equals` that
 * accepts property bags or strings (Temporal's does) never makes an instance equal a plain object.
 */
function opaqueEqual(left: object, right: object) {
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) || !isOpaque(right)) {
    return false;
  }

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
