import { PothosSchemaError } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';

const UNEXPECTED_ERROR = 'Unexpected error.';

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
