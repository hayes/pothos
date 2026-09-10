import { isThenable, PothosValidationError } from '@pothos/core';

/**
 * The guard behind `awaitSelections`. A query is only built asynchronously when a selection
 * beneath the field is async, which the call site cannot see: what it plans is the rest of the
 * document. Rather than hand back a promise where the declared type says there is none — which
 * spreads into a prisma call as one unusable key, with no type error — the promise is refused
 * unless the caller asked for it.
 *
 * The refused promise is left handled, so a plan that also rejects does not report an unhandled
 * rejection on the way out.
 */
export function checkAwaitSelections<T>(
  value: T,
  awaitSelections: boolean | undefined,
  caller: string,
  subject: string,
): T {
  if (awaitSelections || !isThenable(value)) {
    return value;
  }

  value.then(
    () => {},
    () => {},
  );

  throw new PothosValidationError(
    `${caller} could not build the query for ${subject} synchronously, because a selection beneath it is async. Pass awaitSelections: true and await the result.`,
  );
}
