/**
 * Turn any thrown/unknown value into a human-readable string.
 *
 * The failure mode this guards against is `String(someObject)` →
 * `"[object Object]"`, which leaks into the playground console drawer and
 * error banners whenever a non-`Error` value is thrown (a plain object, a
 * GraphQLError-like, a rejected promise carrying an object, etc.).
 *
 * Resolution order:
 *  - `Error`            → its `message`
 *  - `string`           → itself
 *  - `null`/`undefined` → `"null"` / `"undefined"`
 *  - object with a string `message` → that message (GraphQLError-likes)
 *  - other objects      → circular-safe JSON, else a `[ConstructorName]`
 *                         / `[Tag]` label — never `"[object Object]"`
 *  - primitives         → `String(value)`
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err === null || err === undefined) {
    return String(err);
  }
  if (typeof err === 'object') {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.length > 0) {
      return maybeMessage;
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') {
        return json;
      }
    } catch {
      // Circular / non-serializable — fall through to the label form.
    }
    return describeObject(err);
  }
  return String(err);
}

/**
 * A readable label for an object we can't usefully serialize —
 * `[HTMLDivElement]`, `[Event]`, `[MyError]` — instead of `[object Object]`.
 */
function describeObject(value: object): string {
  const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
  const tag = Object.prototype.toString.call(value).slice(8, -1);
  return `[${ctor && ctor !== 'Object' ? ctor : tag}]`;
}
