import { brandWithType, type OutputType, type SchemaTypes, typeBrandKey } from '@pothos/core';

// `brandWithType` from core uses `defineProperty(configurable: false)`.
// Same-value redefinition is a no-op; different-value throws. Every
// helper checks `typeBrandKey in row` first to keep both branches safe.

export function brandResult<T>(result: T, type: string): T;
export function brandResult(result: unknown, type: string): unknown {
  if (result == null) {
    return result;
  }
  // Skip primitives and branded built-ins. Strings/Maps/Sets expose
  // Symbol.iterator but iterating them as rows is wrong.
  if (
    typeof result !== 'object' ||
    result instanceof Error ||
    result instanceof Date ||
    result instanceof Map ||
    result instanceof Set
  ) {
    return result;
  }
  if (typeof (result as { then?: unknown }).then === 'function') {
    return (result as Promise<unknown>).then((awaited) => brandResult(awaited, type));
  }
  if (Array.isArray(result)) {
    for (const row of result) {
      brandRowMaybe(row, type);
    }
    return result;
  }
  if (
    typeof (result as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
  ) {
    return brandAsyncIterable(result as AsyncIterable<unknown>, type);
  }
  if (typeof (result as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
    return brandIterable(result as Iterable<unknown>, type);
  }
  brandRowMaybe(result, type);
  return result;
}

export function brandRowMaybe(row: unknown, type: string): void {
  if (row == null || typeof row !== 'object') {
    return;
  }
  if ((row as Record<symbol, unknown>)[typeBrandKey] !== undefined) {
    return;
  }
  if (row instanceof Error || row instanceof Date) {
    return;
  }
  brandWithType(row as object, type as unknown as OutputType<SchemaTypes>);
}

/**
 * Wrap so the variant carries its own brand without disturbing the
 * parent's brand (which is non-configurable). Callers MUST read
 * variant rows via property access — Object.keys, JSON.stringify, and
 * object spread only see own-properties and will skip parent data.
 */
export function rebrandForVariant<T>(parent: T, variantTypeName: string): T;
export function rebrandForVariant(parent: unknown, variantTypeName: string): unknown {
  if (parent == null || typeof parent !== 'object') {
    return parent;
  }
  const existingBrand = (parent as Record<symbol, unknown>)[typeBrandKey];
  if (existingBrand === variantTypeName) {
    return parent;
  }
  // Always wrap. Branding the parent in place would make order-of-
  // resolution load-bearing: sibling variants on the same row would
  // race on the non-configurable brand slot.
  const wrapper = Object.create(parent as object) as object;
  brandWithType(wrapper, variantTypeName as unknown as OutputType<SchemaTypes>);
  return wrapper;
}

// Hand-rolled iterator wrappers (not async function*) so the consumer
// can cancel the source via return()/throw() — subscription pipelines
// rely on those to close DB cursors.
function brandAsyncIterable(
  source: AsyncIterable<unknown>,
  type: string,
): AsyncIterableIterator<unknown> {
  const iter = source[Symbol.asyncIterator]();
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      const r = await iter.next();
      if (!r.done) {
        brandRowMaybe(r.value, type);
      }
      return r;
    },
    return(value) {
      return iter.return ? iter.return(value) : Promise.resolve({ value, done: true });
    },
    throw(err) {
      return iter.throw ? iter.throw(err) : Promise.reject(err);
    },
  };
}

function brandIterable(source: Iterable<unknown>, type: string): IterableIterator<unknown> {
  const iter = source[Symbol.iterator]();
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      const r = iter.next();
      if (!r.done) {
        brandRowMaybe(r.value, type);
      }
      return r;
    },
    return(value) {
      return iter.return ? iter.return(value) : { value, done: true };
    },
    throw(err) {
      if (iter.throw) {
        return iter.throw(err);
      }
      throw err;
    },
  };
}
