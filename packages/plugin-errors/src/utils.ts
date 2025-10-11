import { sortClasses, typeBrandKey } from '@pothos/core';
import type { GetTypeName } from './types';

export { typeBrandKey };

/**
 * Extracts and sorts Error classes from a mixed array of types.
 * Non-error types (like ObjectRefs) are filtered out.
 * Error classes are sorted by inheritance depth (most specific first).
 *
 * @param types - Array that may contain Error classes and other types
 * @returns Array of only Error constructors, sorted by inheritance
 */
export function extractAndSortErrorTypes<T>(types: T[]): ErrorConstructor[] {
  const errorClasses: (new (...args: never[]) => unknown)[] = [];

  for (const type of types) {
    if (
      typeof type === 'function' &&
      ((type as unknown) === Error || type.prototype instanceof Error)
    ) {
      errorClasses.push(type as new (...args: never[]) => unknown);
    }
  }

  return sortClasses(errorClasses) as ErrorConstructor[];
}

/**
 * @deprecated Use extractAndSortErrorTypes instead
 */
export function sortedErrors<T>(types: T[]): ErrorConstructor[] {
  return extractAndSortErrorTypes(types);
}

export const unwrapError = Symbol.for('Pothos.unwrapErrors');

export const errorTypeMap = new WeakMap<{}, new (...args: never[]) => Error>();

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
  pothosErrors: ErrorConstructor[],
  onResolvedError?: (error: Error) => void,
) {
  for (const errorType of pothosErrors) {
    if (error instanceof errorType) {
      onResolvedError?.(error);
      const result = createErrorProxy(error, errorType, { wrapped: true });

      errorTypeMap.set(result, errorType);

      return result;
    }
  }

  throw error;
}

export function wrapErrorIfMatches(
  value: unknown,
  errorTypes: ErrorConstructor[],
  onResolvedError?: (error: Error) => void,
): unknown {
  if (!(value instanceof Error)) {
    return value;
  }

  for (const errorType of errorTypes) {
    if (value instanceof errorType) {
      onResolvedError?.(value);
      const wrapped = createErrorProxy(value, errorType, { wrapped: true });
      errorTypeMap.set(wrapped, errorType);
      return wrapped;
    }
  }

  return value;
}

export function* yieldErrors(
  result: Iterable<unknown>,
  pothosErrors: ErrorConstructor[],
  onResolvedError?: (error: Error) => void,
) {
  try {
    for (const item of result) {
      yield wrapErrorIfMatches(item, pothosErrors, onResolvedError);
    }
  } catch (error: unknown) {
    yield wrapOrThrow(error, pothosErrors, onResolvedError);
  }
}

export async function* yieldAsyncErrors(
  result: AsyncIterable<unknown>,
  pothosErrors: ErrorConstructor[],
  onResolvedError?: (error: Error) => void,
) {
  try {
    for await (const item of result) {
      yield wrapErrorIfMatches(item, pothosErrors, onResolvedError);
    }
  } catch (error: unknown) {
    yield wrapOrThrow(error, pothosErrors, onResolvedError);
  }
}
