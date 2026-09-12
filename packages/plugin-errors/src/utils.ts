import { sortClasses, typeBrandKey } from '@pothos/core';
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

// A non-extensible target forces a Proxy's `getPrototypeOf` to report the target's own prototype.
function createProxyTarget(target: {}): {} {
  if (Object.isExtensible(target)) {
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
  return new Proxy(createProxyTarget(target), {
    get(err, val, receiver) {
      if (val === unwrapError) {
        return () => {
          state.wrapped = false;
        };
      }

      if (val === typeBrandKey) {
        return ref;
      }

      return Reflect.get(err, val, receiver) as unknown;
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

export async function* yieldAsyncErrors(
  result: AsyncIterable<unknown>,
  pothosErrors: (new (...args: never[]) => unknown)[],
  onResolvedError?: (error: Error) => void,
  depth = 0,
): AsyncGenerator<unknown> {
  try {
    for await (const item of result) {
      if (
        depth > 0 &&
        item !== null &&
        typeof item === 'object' &&
        !(item instanceof Error) &&
        Symbol.asyncIterator in item
      ) {
        const nestedResults: unknown[] = [];
        for await (const nested of yieldAsyncErrors(
          item as AsyncIterable<unknown>,
          pothosErrors,
          onResolvedError,
          depth - 1,
        )) {
          nestedResults.push(nested);
        }
        yield nestedResults;
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
