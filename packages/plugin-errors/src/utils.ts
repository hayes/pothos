import { sortClasses, typeBrandKey } from '@pothos/core';
import type { GetTypeName } from './types';

export { typeBrandKey };

export function extractAndSortErrorTypes<T>(types: T[]): ErrorConstructor[] {
  const errorClasses: (new (...args: never[]) => unknown)[] = [];

  for (const type of types) {
    // Accept any constructor function as a potential error type.
    // This allows error-like classes that don't extend Error in the traditional way
    // (e.g., ZodError in Zod v4) to still be used, as long as instanceof checks work.
    if (typeof type === 'function') {
      errorClasses.push(type as new (...args: never[]) => unknown);
    }
  }

  return sortClasses(errorClasses) as ErrorConstructor[];
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
      onResolvedError?.(error as Error);
      const result = createErrorProxy(error as {}, errorType, { wrapped: true });

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
  // Check if value matches any of the error types, even if it's not instanceof Error
  // This handles error-like objects that don't extend Error (e.g., ZodError in Zod v4)
  for (const errorType of errorTypes) {
    if (value instanceof errorType) {
      onResolvedError?.(value as Error);
      const wrapped = createErrorProxy(value as {}, errorType, { wrapped: true });
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
