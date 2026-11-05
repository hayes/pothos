import type { GraphQLError } from 'graphql';
import { expect } from 'vitest';

/**
 * The developer detail of an error the plugin raises while a request runs, the message of its
 * `cause`, after checking that a client sees only `Unexpected error.`. Takes the error a result
 * holds, or the error itself.
 */
export function detailOf(error: unknown): string {
  const original = (error as Partial<GraphQLError>)?.originalError ?? error;
  expect((error as Error).message).toBe('Unexpected error.');
  expect((original as Error).message).toBe('Unexpected error.');
  const { cause } = original as Error;
  expect(cause).toBeInstanceOf(Error);
  return (cause as Error).message;
}

/** Matches an error a client sees as `Unexpected error.`, whose `cause` has `detail`. */
export function unexpected(detail: string | RegExp) {
  return expect.objectContaining({
    message: 'Unexpected error.',
    cause: expect.objectContaining({
      message:
        typeof detail === 'string' ? expect.stringContaining(detail) : expect.stringMatching(detail),
    }),
  });
}
