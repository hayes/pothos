/**
 * Structural equality for query arguments (`where`, `orderBy`, `take`, ...). Keys holding
 * `undefined` are treated as absent, so `{ where: cond ? filter : undefined }` compares equal to
 * `{}` when the condition is false.
 *
 * Plain objects and arrays compare by value, and Dates by their time. Any other object (a Temporal
 * value, a `Decimal`, a `Buffer`, a typed array) equals only an object of the same prototype that
 * its `equals` method accepts, or itself when it has none.
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

  const leftPlain = isPlain(left);

  if (leftPlain !== isPlain(right)) {
    return false;
  }

  if (!leftPlain) {
    return instancesEqual(left, right);
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

function isPlain(value: object) {
  const proto = Object.getPrototypeOf(value);

  return proto === null || proto === Object.prototype;
}

/**
 * The shared prototype keeps the comparison symmetric, since Temporal's `equals` also accepts
 * property bags and strings.
 */
function instancesEqual(left: object, right: object) {
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
    return false;
  }

  if (left instanceof Date) {
    return left.getTime() === (right as Date).getTime();
  }

  const { equals } = left as { equals?: unknown };

  return typeof equals === 'function' && equals.call(left, right) === true;
}

function comparedKeys(value: Record<string, unknown>) {
  return Object.keys(value).filter((key) => value[key] !== undefined);
}
