import { sortClasses, typeBrandKey } from '@pothos/core';
import type { GetTypeName } from './types';

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

export function createErrorProxy(target: {}, ref: unknown, state: { wrapped: boolean }): {} {
  return new Proxy(target, {
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

export function* yieldErrors(
  result: Iterable<unknown>,
  pothosErrors: (new (...args: never[]) => unknown)[],
  onResolvedError?: (error: Error) => void,
): Generator<unknown> {
  try {
    for (const item of result) {
      if (
        item !== null &&
        typeof item === 'object' &&
        !(item instanceof Error) &&
        Symbol.iterator in item
      ) {
        yield [...yieldErrors(item as Iterable<unknown>, pothosErrors, onResolvedError)];
      } else {
        yield wrapErrorIfMatches(item, pothosErrors, onResolvedError);
      }
    }
  } catch (error: unknown) {
    yield wrapOrThrow(error, pothosErrors, onResolvedError);
  }
}

export async function* yieldAsyncErrors(
  result: AsyncIterable<unknown>,
  pothosErrors: (new (...args: never[]) => unknown)[],
  onResolvedError?: (error: Error) => void,
): AsyncGenerator<unknown> {
  try {
    for await (const item of result) {
      if (
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
        )) {
          nestedResults.push(nested);
        }
        yield nestedResults;
      } else if (
        item !== null &&
        typeof item === 'object' &&
        !(item instanceof Error) &&
        Symbol.iterator in item
      ) {
        yield [...yieldErrors(item as Iterable<unknown>, pothosErrors, onResolvedError)];
      } else {
        yield wrapErrorIfMatches(item, pothosErrors, onResolvedError);
      }
    }
  } catch (error: unknown) {
    yield wrapOrThrow(error, pothosErrors, onResolvedError);
  }
}
