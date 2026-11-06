import type { GraphQLResolveInfo } from 'graphql';

/** What a client sees of an error this plugin raises while a request runs. */
export const UNEXPECTED_ERROR = 'Unexpected error.';

/**
 * An error this plugin raises while a request runs, for a problem in the app's schema or code
 * rather than in the request. Clients see only `Unexpected error.`: `detail` is the message of its
 * `cause`, which graphql-js leaves out of responses but loggers and debuggers show.
 */
export class InternalError extends Error {
  constructor(detail: string, options?: { cause?: unknown }) {
    super(UNEXPECTED_ERROR, { cause: new Error(detail, options) });
  }
}

/**
 * Errors `reloadFor` rethrows as they are: those of the app's code and the client, which keep their
 * class, client-safe errors such as `Invalid ID.`, and errors that already name their field. A
 * database error from a query the plugin issues isn't kept. Errors from running a collection a
 * resolver returned never pass through `reloadFor`.
 */
const kept = new WeakSet<object>();

/** Marks `error` to be rethrown as it is by `reloadFor`. */
export function keepError<T>(error: T): T {
  if (typeof error === 'object' && error !== null) {
    kept.add(error);
  }
  return error;
}

/**
 * `error`, from loading a parent or relation for `info`'s field. Any other error is the plugin's,
 * which the client sees only as `Unexpected error.`, with the field named in its `cause`.
 */
function fieldError(info: GraphQLResolveInfo, error: unknown): unknown {
  if (typeof error === 'object' && error !== null && kept.has(error)) {
    return error;
  }
  // An error already generic, such as the plugin's own, is named by the detail in its cause.
  const detail =
    error instanceof Error && error.message === UNEXPECTED_ERROR && error.cause instanceof Error
      ? error.cause.message
      : error instanceof Error
        ? error.message
        : String(error);
  return keepError(
    new InternalError(`${info.parentType.name}.${info.fieldName}: ${detail}`, { cause: error }),
  );
}

/**
 * Runs `load`, a load this plugin runs for `info`'s field, and keeps the plugin's own errors in what
 * it throws or rejects with out of the response. Errors from the field's resolver aren't passed
 * through it.
 */
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
