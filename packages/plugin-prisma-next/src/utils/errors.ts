import type { GraphQLResolveInfo } from 'graphql';

/**
 * Errors rethrown as they are: what a field's select function threw, and errors that already name
 * their field.
 */
const named = new WeakSet<object>();

/** Marks `error` to be rethrown as it is by `reloadFor`. */
export function keepError<T>(error: T): T {
  if (typeof error === 'object' && error !== null) {
    named.add(error);
  }
  return error;
}

/** `error`, from loading a parent or relation for `info`'s field, named after the field. */
function fieldError(info: GraphQLResolveInfo, error: unknown): unknown {
  if (typeof error === 'object' && error !== null && named.has(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return keepError(
    new Error(`${info.parentType.name}.${info.fieldName}: ${message}`, { cause: error }),
  );
}

/**
 * Runs `load`, a load this plugin runs for `info`'s field, and names the field in the error it
 * throws or rejects with. Errors from the field's resolver aren't passed through it.
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
