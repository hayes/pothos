import { PothosValidationError } from '../errors.js';

/** Arguments and limits for a cursor connection, independent of the Relay plugin. */
export interface CursorConnectionOptions {
  args: {
    before?: string | null;
    after?: string | null;
    first?: number | null;
    last?: number | null;
  };
  defaultSize?: number;
  maxSize?: number;
  totalCount?: number;
}

export function parseCursorConnectionArgs(options: CursorConnectionOptions) {
  const { before, after, first, last } = options.args;

  const defaultSize = options.defaultSize ?? 20;
  const maxSize = options.maxSize ?? 100;

  if (first != null && first < 0) {
    throw new PothosValidationError('Argument "first" must be a non-negative integer');
  }

  if (last != null && last < 0) {
    throw new PothosValidationError('Argument "last" must be a non-negative integer');
  }

  // `first`/`last` are checked for presence rather than truthiness so that a page size of 0
  // (which the validation above allows) is treated as a requested page size, and not as an
  // omitted argument.
  const hasFirst = first != null;
  const hasLast = last != null;

  const limit = Math.min(first ?? last ?? defaultSize, maxSize) + 1;
  const inverted = after ? hasLast && !hasFirst : (!!before && !hasFirst) || (!hasFirst && hasLast);

  return {
    before: before ?? undefined,
    after: after ?? undefined,
    limit,
    expectedSize: limit - 1,
    inverted,
    hasPreviousPage: (resultSize: number) => (inverted ? resultSize >= limit : !!after),
    hasNextPage: (resultSize: number) => (inverted ? !!before : resultSize >= limit),
  };
}
