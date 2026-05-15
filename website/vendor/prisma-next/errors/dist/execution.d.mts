import { r as CliStructuredError } from "./control-ekdDo8G9.mjs";
import { SchemaIssue, VerifyDatabaseSchemaResult } from "@prisma-next/framework-components/control";

//#region src/execution.d.ts

/**
 * Contract marker not found in database.
 */
declare function errorMarkerMissing(options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * Contract hash does not match database marker.
 */
declare function errorHashMismatch(options?: {
  readonly why?: string;
  readonly expected?: string;
  readonly actual?: string;
}): CliStructuredError;
/**
 * Contract target does not match config target.
 */
declare function errorTargetMismatch(expected: string, actual: string, options?: {
  readonly why?: string;
}): CliStructuredError;
/**
 * Database marker is required but not found.
 * Used by commands that require a pre-existing marker as a precondition.
 */
declare function errorMarkerRequired(options?: {
  readonly why?: string;
  readonly fix?: string;
}): CliStructuredError;
/**
 * Schema verification found mismatches between the database and the contract.
 * The full verification tree is preserved in `meta.verificationResult`.
 */
declare function errorSchemaVerificationFailed(options: {
  readonly summary: string;
  readonly verificationResult: VerifyDatabaseSchemaResult;
  readonly issues?: readonly SchemaIssue[];
}): CliStructuredError;
/**
 * Migration runner failed during execution.
 */
declare function errorRunnerFailed(summary: string, options?: {
  readonly why?: string;
  readonly fix?: string;
  readonly meta?: Record<string, unknown>;
}): CliStructuredError;
/** Error code for destructive changes that require explicit confirmation. */
declare const ERROR_CODE_DESTRUCTIVE_CHANGES = "3030";
/**
 * Destructive operations require explicit confirmation via -y/--yes.
 */
declare function errorDestructiveChanges(summary: string, options?: {
  readonly why?: string;
  readonly fix?: string;
  readonly meta?: Record<string, unknown>;
}): CliStructuredError;
/**
 * Generic runtime error.
 */
declare function errorRuntime(summary: string, options?: {
  readonly why?: string;
  readonly fix?: string;
  readonly meta?: Record<string, unknown>;
}): CliStructuredError;
//#endregion
export { ERROR_CODE_DESTRUCTIVE_CHANGES, errorDestructiveChanges, errorHashMismatch, errorMarkerMissing, errorMarkerRequired, errorRunnerFailed, errorRuntime, errorSchemaVerificationFailed, errorTargetMismatch };
//# sourceMappingURL=execution.d.mts.map