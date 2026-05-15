//#region src/control.d.ts
/**
 * CLI error envelope for output formatting.
 * This is the serialized form of a CliStructuredError.
 */
interface CliErrorEnvelope {
  readonly ok: false;
  readonly code: string;
  readonly domain: string;
  readonly severity: 'error' | 'warn' | 'info';
  readonly summary: string;
  readonly why: string | undefined;
  readonly fix: string | undefined;
  readonly where: {
    readonly path: string | undefined;
    readonly line: number | undefined;
  } | undefined;
  readonly meta: Record<string, unknown> | undefined;
  readonly docsUrl: string | undefined;
}
/**
 * Minimal conflict data structure expected by CLI output.
 */
interface CliErrorConflict {
  readonly kind: string;
  readonly summary: string;
  readonly why?: string;
}
/**
 * Domain prefix for structured CLI error codes.
 *
 * The full envelope code is rendered as `PN-<domain>-<code>` (see
 * `CliStructuredError.toEnvelope`). The supported domains follow the
 * taxonomy documented in `docs/CLI Style Guide.md`:
 *
 * - `CLI`    — CLI command processing (config, validation, planning)
 * - `MIG`    — Migration subsystem (authoring, planning conflicts, runner)
 * - `RUN`    — Application runtime (query execution, streaming)
 * - `CON`    — Contract subsystem (validation, normalization)
 * - `SCHEMA` — Schema subsystem
 *
 * Sub-clustering within a domain is conveyed by the numeric code range; see
 * the per-domain source files for reserved ranges.
 */
declare const CLI_ERROR_DOMAINS: readonly ["CLI", "RUN", "MIG", "CON", "SCHEMA"];
type CliErrorDomain = (typeof CLI_ERROR_DOMAINS)[number];
/**
 * Structured CLI error that contains all information needed for error envelopes.
 * Call sites throw these errors with full context.
 */
declare class CliStructuredError extends Error {
  readonly code: string;
  readonly domain: CliErrorDomain;
  readonly severity: 'error' | 'warn' | 'info';
  readonly why: string | undefined;
  readonly fix: string | undefined;
  readonly where: {
    readonly path: string | undefined;
    readonly line: number | undefined;
  } | undefined;
  readonly meta: Record<string, unknown> | undefined;
  readonly docsUrl: string | undefined;
  constructor(code: string, summary: string, options?: {
    readonly domain?: CliErrorDomain;
    readonly severity?: 'error' | 'warn' | 'info';
    readonly why?: string;
    readonly fix?: string;
    readonly where?: {
      readonly path?: string;
      readonly line?: number;
    };
    readonly meta?: Record<string, unknown>;
    readonly docsUrl?: string;
  });
  /**
   * Converts this error to a CLI error envelope for output formatting.
   */
  toEnvelope(): CliErrorEnvelope;
  /**
   * Type guard to check if an error is a CliStructuredError.
   * Uses duck-typing to work across module boundaries where instanceof may fail.
   */
  static is(error: unknown): error is CliStructuredError;
}
/**
 * Config file not found or missing.
 */
declare function errorConfigFileNotFound(configPath?: string, options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * Contract configuration missing from config.
 */
declare function errorContractConfigMissing(options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * Contract validation failed.
 */
declare function errorContractValidationFailed(reason: string, options?: {
  readonly where?: {
    readonly path?: string;
    readonly line?: number;
  };
}): CliStructuredError;
/**
 * File not found.
 */
declare function errorFileNotFound(filePath: string, options?: {
  readonly why?: string;
  readonly fix?: string;
  readonly docsUrl?: string;
}): CliStructuredError;
/**
 * Database connection is required but not provided.
 */
declare function errorDatabaseConnectionRequired(options?: {
  readonly why?: string;
  readonly commandName?: string;
  readonly retryCommand?: string;
}): CliStructuredError;
/**
 * Query runner factory is required but not provided in config.
 */
declare function errorQueryRunnerFactoryRequired(options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * Family verify.readMarker is required but not provided.
 */
declare function errorFamilyReadMarkerSqlRequired(options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * JSON output format not supported.
 */
declare function errorJsonFormatNotSupported(options: {
  readonly command: string;
  readonly format: string;
  readonly supportedFormats: readonly string[];
}): CliStructuredError;
/**
 * Driver is required for DB-connected commands but not provided.
 */
declare function errorDriverRequired(options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * Contract requires extension packs that are not provided by config descriptors.
 */
declare function errorContractMissingExtensionPacks(options: {
  readonly missingExtensionPacks: readonly string[];
  readonly providedComponentIds: readonly string[];
}): CliStructuredError;
/**
 * Migration planning failed due to conflicts.
 */
declare function errorMigrationPlanningFailed(options: {
  readonly conflicts: readonly CliErrorConflict[];
  readonly why?: string;
}): CliStructuredError;
/**
 * Target does not support migrations (missing createPlanner/createRunner).
 */
declare function errorTargetMigrationNotSupported(options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * The migration-file CLI received `--config` without a path argument (either
 * a bare trailing `--config`, or `--config` followed by another flag like
 * `--config --dry-run`). Surfacing this as a structured error fails fast
 * rather than silently consuming the next flag as the config path or
 * falling back to default discovery against the wrong project.
 */
declare function errorMigrationCliInvalidConfigArg(options?: {
  readonly nextToken?: string;
}): CliStructuredError;
/**
 * The migration-file CLI received a flag it does not recognise. Surfaced as a
 * structured error so consumers can render their own "did you mean"
 * suggestions from `meta.knownFlags` rather than parsing the message.
 *
 * Designed to wrap clipanion's `UnknownSyntaxError` at the parser boundary:
 * pass the offending token as `flag` and the option declarations as
 * `knownFlags`.
 */
declare function errorMigrationCliUnknownFlag(options: {
  readonly flag: string;
  readonly knownFlags: readonly string[];
}): CliStructuredError;
/**
 * Config validation error (missing required fields).
 */
declare function errorConfigValidation(field: string, options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * Generic unexpected error.
 */
declare function errorUnexpected(message: string, options?: {
  readonly why?: string;
  readonly fix?: string;
}): CliStructuredError;
//#endregion
export { errorQueryRunnerFactoryRequired as _, errorConfigValidation as a, errorContractValidationFailed as c, errorFamilyReadMarkerSqlRequired as d, errorFileNotFound as f, errorMigrationPlanningFailed as g, errorMigrationCliUnknownFlag as h, errorConfigFileNotFound as i, errorDatabaseConnectionRequired as l, errorMigrationCliInvalidConfigArg as m, CliErrorEnvelope as n, errorContractConfigMissing as o, errorJsonFormatNotSupported as p, CliStructuredError as r, errorContractMissingExtensionPacks as s, CliErrorConflict as t, errorDriverRequired as u, errorTargetMigrationNotSupported as v, errorUnexpected as y };
//# sourceMappingURL=control-ekdDo8G9.d.mts.map