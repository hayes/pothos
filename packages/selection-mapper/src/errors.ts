import { PothosValidationError } from '@pothos/core';

/**
 * An error raised while a request runs for a problem in the app's schema or code. Clients see only
 * `Unexpected error.`; `detail` is the message of its `cause`, which responses leave out.
 */
export function unexpectedError(detail: string) {
  const error = new PothosValidationError('Unexpected error.');
  error.cause = new PothosValidationError(detail);

  return error;
}
