import { mapAsyncIterator, sortClasses, typeBrandKey } from '@pothos/core';
import type { GetTypeName } from './types.js';

export { typeBrandKey };

export function extractAndSortErrorTypes<T>(types: T[]): (new (...args: never[]) => unknown)[] {
  const errorClasses: (new (...args: never[]) => unknown)[] = [];

  for (const type of types) {
    if (typeof type === 'function') {
      errorClasses.push(type as new (...args: never[]) => unknown);
    }
  }

  return sortClasses(errorClasses);
}

export const unwrapError = Symbol.for('Pothos.unwrapErrors');

export const errorTypeMap = new WeakMap<{}, new (...args: never[]) => unknown>();

export function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}

export const defaultGetUnionName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${capitalize(fieldName)}Result`;

export const defaultGetResultName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${capitalize(fieldName)}Success`;

export const defaultGetListItemResultName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${capitalize(fieldName)}ItemSuccess`;

export const defaultGetListItemUnionName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${capitalize(fieldName)}ItemResult`;

function createProxyTarget(target: {}): {} {
  const hasFixedMethod = Reflect.ownKeys(target).some((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
    return (
      key !== 'constructor' &&
      descriptor.configurable === false &&
      descriptor.writable === false &&
      typeof descriptor.value === 'function'
    );
  });
  // A get trap cannot bind a fixed own method while using the original as its
  // proxy target. A configurable copy leaves those invariants intact.
  if (Object.isExtensible(target) && !hasFixedMethod) {
    return target;
  }

  const copy = Object.create(Object.getPrototypeOf(target) as object | null) as {};

  for (const key of Reflect.ownKeys(target)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);

    if (descriptor) {
      Object.defineProperty(copy, key, { ...descriptor, configurable: true });
    }
  }

  return copy;
}

export function createErrorProxy(target: {}, ref: unknown, state: { wrapped: boolean }): {} {
  const methods = new WeakMap<object, unknown>();
  return new Proxy(createProxyTarget(target), {
    get(_err, val) {
      if (val === unwrapError) {
        return () => {
          state.wrapped = false;
        };
      }

      if (val === typeBrandKey) {
        return ref;
      }

      // Private fields live on the original instance, including when the proxy target
      // is a descriptor copy of a frozen error.
      const value: unknown = Reflect.get(target, val, target);
      if (typeof value !== 'function' || val === 'constructor') {
        return value;
      }
      let bound = methods.get(value);
      if (!bound) {
        bound = value.bind(target);
        methods.set(value, bound);
      }
      return bound;
    },
    set(_err, key, value) {
      return Reflect.set(target, key, value, target);
    },
    getPrototypeOf(err) {
      const proto = Reflect.getPrototypeOf(err) as {};

      if (!state.wrapped || !proto) {
        return proto;
      }

      return createErrorProxy(proto, ref, state);
    },
  });
}

export function wrapOrThrow(
  error: unknown,
  pothosErrors: (new (...args: never[]) => unknown)[],
  onResolvedError?: (error: Error) => void,
) {
  for (const errorType of pothosErrors) {
    if (error instanceof errorType) {
      onResolvedError?.(error as Error);
      const result = createErrorProxy(error as Error, errorType, { wrapped: true });

      errorTypeMap.set(result, errorType);

      return result;
    }
  }

  throw error;
}

export function wrapErrorIfMatches(
  value: unknown,
  errorTypes: (new (...args: never[]) => unknown)[],
  onResolvedError?: (error: Error) => void,
): unknown {
  for (const errorType of errorTypes) {
    if (value instanceof errorType) {
      onResolvedError?.(value as Error);
      const wrapped = createErrorProxy(value as Error, errorType, { wrapped: true });
      errorTypeMap.set(wrapped, errorType);
      return wrapped;
    }
  }

  return value;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    ((typeof value === 'object' && value !== null) || typeof value === 'function') &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

function isNestedList(item: unknown): item is Iterable<unknown> {
  return (
    item !== null && typeof item === 'object' && !(item instanceof Error) && Symbol.iterator in item
  );
}

function wrapItem(
  item: unknown,
  pothosErrors: (new (...args: never[]) => unknown)[],
  onResolvedError?: (error: Error) => void,
  depth = 0,
): unknown {
  if (depth > 0) {
    return isNestedList(item)
      ? [...yieldErrors(item, pothosErrors, onResolvedError, depth - 1)]
      : item;
  }

  return wrapErrorIfMatches(item, pothosErrors, onResolvedError);
}

export function* yieldErrors(
  result: Iterable<unknown>,
  pothosErrors: (new (...args: never[]) => unknown)[],
  onResolvedError?: (error: Error) => void,
  depth = 0,
): Generator<unknown> {
  try {
    for (const item of result) {
      if (isThenable(item)) {
        yield Promise.resolve(item).then(
          (value) => wrapItem(value, pothosErrors, onResolvedError, depth),
          (error: unknown) => {
            if (depth > 0) {
              throw error;
            }

            return wrapOrThrow(error, pothosErrors, onResolvedError);
          },
        );
      } else {
        yield wrapItem(item, pothosErrors, onResolvedError, depth);
      }
    }
  } catch (error: unknown) {
    if (depth > 0) {
      throw error;
    }

    yield wrapOrThrow(error, pothosErrors, onResolvedError);
  }
}

// This scope owns children only; retained control methods must not retain the
// mapping policy or its request callbacks after mapAsyncIterator releases them.
class NestedIteratorOwner {
  private active = new Set<AsyncGenerator<unknown>>();
  private closed = false;
  private generation = 0;
  private readonly parentGeneration: number | undefined;

  constructor(private parent?: NestedIteratorOwner) {
    this.parentGeneration = parent?.generation;
  }

  private get isClosed(): boolean {
    return (
      this.closed ||
      (this.parent !== undefined &&
        (this.parent.isClosed || this.parent.generation !== this.parentGeneration))
    );
  }

  async collect(nested: AsyncGenerator<unknown>): Promise<unknown[]> {
    if (this.isClosed) {
      await nested.return(undefined);
      return [];
    }
    this.active.add(nested);
    const values: unknown[] = [];
    for await (const value of nested) {
      values.push(value);
    }
    return values;
  }

  release(nested: AsyncGenerator<unknown>) {
    this.active.delete(nested);
  }

  async closeActive() {
    // Children being closed cannot open new descendants during cleanup.
    this.generation += 1;
    const children = [...this.active];
    // Relinquish ownership before cleanup, including reentrant or failed cleanup.
    // Like iterator closing, request return once without draining cleanup yields.
    this.active.clear();
    const results = await Promise.allSettled(children.map((child) => child.return(undefined)));
    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason;
      }
    }
  }

  close() {
    this.closed = true;
    this.parent = undefined;
    return this.closeActive();
  }
}

function closeNestedOnControl(
  iterator: AsyncIterableIterator<unknown> & AsyncGenerator<unknown>,
  owner: NestedIteratorOwner,
) {
  for (const method of ['return', 'throw'] as const) {
    const operation = iterator[method].bind(iterator);
    iterator[method] = (...args: [] | [unknown]) => {
      const closing = owner.closeActive();
      return Promise.allSettled([operation(...args), closing]).then(([result, cleanup]) => {
        if (result.status === 'rejected') {
          throw result.reason;
        }
        if (cleanup.status === 'rejected') {
          throw cleanup.reason;
        }
        return result.value;
      });
    };
  }
  return iterator;
}

export function yieldAsyncErrors(
  result: AsyncIterable<unknown>,
  pothosErrors: (new (...args: never[]) => unknown)[],
  onResolvedError?: (error: Error) => void,
  depth = 0,
): AsyncGenerator<unknown> {
  return createAsyncErrorIterator(result, pothosErrors, onResolvedError, depth);
}

function createAsyncErrorIterator(
  result: AsyncIterable<unknown>,
  pothosErrors: (new (...args: never[]) => unknown)[],
  onResolvedError: ((error: Error) => void) | undefined,
  depth: number,
  parent?: NestedIteratorOwner,
): AsyncIterableIterator<unknown> & AsyncGenerator<unknown> {
  const owner = depth > 0 ? new NestedIteratorOwner(parent) : undefined;
  const mapItem = (item: unknown) => {
    if (
      owner &&
      item !== null &&
      typeof item === 'object' &&
      !(item instanceof Error) &&
      Symbol.asyncIterator in item
    ) {
      return owner.collect(
        createAsyncErrorIterator(
          item as AsyncIterable<unknown>,
          pothosErrors,
          onResolvedError,
          depth - 1,
          owner,
        ),
      );
    }
    return wrapItem(item, pothosErrors, onResolvedError, depth);
  };
  const onError = (error: unknown) => {
    if (depth > 0) {
      throw error;
    }
    return wrapOrThrow(error, pothosErrors, onResolvedError);
  };
  let mapped: AsyncIterableIterator<unknown> & AsyncGenerator<unknown>;
  const onClose = () => {
    parent?.release(mapped);
    return owner?.close();
  };
  try {
    mapped = mapAsyncIterator(result[Symbol.asyncIterator](), mapItem, onError, onClose);
  } catch (error) {
    mapped = mapAsyncIterator({ next: () => Promise.reject(error) }, mapItem, onError, onClose);
  }
  return owner ? closeNestedOnControl(mapped, owner) : mapped;
}
