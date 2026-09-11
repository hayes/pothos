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

/** Validate page-size arguments without imposing cursor or direction restrictions. */
export function validateConnectionArguments({
  first,
  last,
}: Pick<CursorConnectionOptions['args'], 'first' | 'last'>) {
  if (first != null && first < 0) {
    throw new PothosValidationError('Argument "first" must be a non-negative integer');
  }

  if (last != null && last < 0) {
    throw new PothosValidationError('Argument "last" must be a non-negative integer');
  }
}

/** Include one extra row so a connection can determine whether another page exists. */
export function getConnectionPageSize({
  args: { first, last },
  defaultSize = 20,
  maxSize = 100,
}: Pick<CursorConnectionOptions, 'args' | 'defaultSize' | 'maxSize'>) {
  const expectedSize = Math.min(first ?? last ?? defaultSize, maxSize);

  return { limit: expectedSize + 1, expectedSize };
}

export function parseCursorConnectionArgs(options: CursorConnectionOptions) {
  const { before, after, first, last } = options.args;

  validateConnectionArguments(options.args);

  // `first`/`last` are checked for presence rather than truthiness so that a page size of 0
  // (which the validation above allows) is treated as a requested page size, and not as an
  // omitted argument.
  const hasFirst = first != null;
  const hasLast = last != null;

  const { limit, expectedSize } = getConnectionPageSize({
    ...options,
    defaultSize: options.defaultSize ?? 20,
    maxSize: options.maxSize ?? 100,
  });
  const inverted = after ? hasLast && !hasFirst : (!!before && !hasFirst) || (!hasFirst && hasLast);

  return {
    before: before ?? undefined,
    after: after ?? undefined,
    limit,
    expectedSize,
    inverted,
    hasPreviousPage: (resultSize: number) => (inverted ? resultSize >= limit : !!after),
    hasNextPage: (resultSize: number) => (inverted ? !!before : resultSize >= limit),
  };
}
