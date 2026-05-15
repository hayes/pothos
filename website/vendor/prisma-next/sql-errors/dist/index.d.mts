//#region src/errors.d.ts
interface SqlDriverError<Kind extends string> {
  readonly kind: Kind;
}
/**
 * SQL query error for query-related failures (syntax errors, constraint violations, permissions).
 */
declare class SqlQueryError extends Error implements SqlDriverError<'sql_query'> {
  static readonly ERROR_NAME: "SqlQueryError";
  readonly kind: "sql_query";
  readonly sqlState: string | undefined;
  readonly constraint: string | undefined;
  readonly table: string | undefined;
  readonly column: string | undefined;
  readonly detail: string | undefined;
  constructor(message: string, options?: {
    readonly cause?: Error;
    readonly sqlState?: string;
    readonly constraint?: string;
    readonly table?: string;
    readonly column?: string;
    readonly detail?: string;
  });
  /**
   * Type predicate to check if an error is a SqlQueryError.
   */
  static is(error: unknown): error is SqlQueryError;
}
/**
 * SQL connection error (timeouts, connection resets, etc.).
 */
declare class SqlConnectionError extends Error implements SqlDriverError<'sql_connection'> {
  static readonly ERROR_NAME: "SqlConnectionError";
  readonly kind: "sql_connection";
  readonly transient: boolean | undefined;
  constructor(message: string, options?: {
    readonly cause?: Error;
    readonly transient?: boolean;
  });
  /**
   * Type predicate to check if an error is a SqlConnectionError.
   */
  static is(error: unknown): error is SqlConnectionError;
}
//#endregion
export { SqlConnectionError, SqlQueryError };
//# sourceMappingURL=index.d.mts.map