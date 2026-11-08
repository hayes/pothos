import { PothosSchemaError, PothosValidationError } from '@pothos/core';
import { SqlQueryError } from '@prisma/orm-family-sql/errors';
import type { GraphQLResolveInfo } from 'graphql';

export const UNEXPECTED_ERROR = 'Unexpected error.';

/**
 * A request-time problem in the app's schema or code. Clients see only `Unexpected error.`;
 * `detail` goes in `cause`, which graphql-js leaves out of responses.
 */
export class InternalError extends Error {
  constructor(detail: string, options?: { cause?: unknown }) {
    super(UNEXPECTED_ERROR, { cause: new Error(detail, options) });
  }
}

/** Runs build-time checks on what an app's function returned, hiding their detail from clients. */
export function checkReturned<V, T>(value: V, check: (value: V) => T): T {
  try {
    return check(value);
  } catch (error) {
    throw error instanceof PothosSchemaError
      ? new InternalError(error.message, { cause: error })
      : error;
  }
}

/**
 * SQLSTATEs of a value its column codec accepts but the database can't represent, such as text
 * holding a NUL (22021). Other data exceptions, such as division by zero, aren't the value's.
 */
const REFUSED_VALUE_STATES = new Set(['22021', '22P02', '22P05', '22007', '22008']);

export function isRefusedValue(error: unknown): error is SqlQueryError {
  return SqlQueryError.is(error) && REFUSED_VALUE_STATES.has(error.sqlState ?? '');
}

export function refusedError(message: string, cause: Error): PothosValidationError {
  return keepError(
    Object.assign(new PothosValidationError(message, { originalError: cause }), { cause }),
  );
}

/**
 * Errors `reloadFor` rethrows as they are: the app's and client's (which keep their class),
 * client-safe ones such as `Invalid ID.`, and those that already name their field. A database
 * error from the plugin's own query isn't kept.
 */
const kept = new WeakSet<object>();

export function keepError<T>(error: T): T {
  if (typeof error === 'object' && error !== null) {
    kept.add(error);
  }
  return error;
}

function fieldError(info: GraphQLResolveInfo, error: unknown): unknown {
  if (typeof error === 'object' && error !== null && kept.has(error)) {
    return error;
  }
  const detail =
    error instanceof Error && error.message === UNEXPECTED_ERROR && error.cause instanceof Error
      ? error.cause.message
      : error instanceof Error
        ? error.message
        : String(error);
  return keepError(fieldInternalError(info, detail, error));
}

export function fieldInternalError(info: GraphQLResolveInfo, detail: string, cause: unknown) {
  return new InternalError(`${info.parentType.name}.${info.fieldName}: ${detail}`, { cause });
}

/** Runs a load for `info`'s field, keeping the plugin's own error details out of the response. */
export function reloadFor<T>(info: GraphQLResolveInfo, load: () => Promise<T>): Promise<T> {
  const rethrow = (error: unknown): never => {
    throw fieldError(info, error);
  };
  try {
    return load().catch(rethrow);
  } catch (error) {
    return Promise.reject(fieldError(info, error));
  }
}

/**
 * Plans are cached on the `info.path` objects graphql-js passes, which graphql-jit rebuilds for each
 * call, without a `typename`. Under it the plugin fails closed, as scope-auth's `isTypeOf` does.
 */
export function assertGraphQLJsInfo(info: GraphQLResolveInfo) {
  if (!info?.path || !('typename' in info.path)) {
    throw new InternalError(
      '@pothos/plugin-prisma-next needs the resolve info graphql-js passes, so it does not support graphql-jit.',
    );
  }
}
