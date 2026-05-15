//#region src/redact-db-url.d.ts
/**
 * Minimal metadata extracted from a database URL for logging or error output.
 * Sensitive fields (password, full URL) are never returned.
 */
interface RedactedDatabaseUrl {
  readonly host?: string;
  readonly port?: string;
  readonly database?: string;
  readonly username?: string;
}
/**
 * Redacts a database connection URL to a minimal metadata object.
 *
 * Parsing errors are ignored and result in an empty object so callers never
 * leak raw URLs when the input is malformed.
 */
declare function redactDatabaseUrl(url: string): RedactedDatabaseUrl;
//#endregion
export { type RedactedDatabaseUrl, redactDatabaseUrl };
//# sourceMappingURL=redact-db-url.d.mts.map