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
