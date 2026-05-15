import { t as CliStructuredError } from "./control-Cver1h9Q.mjs";
import { ifDefined } from "@prisma-next/utils/defined";

//#region src/execution.ts
/**
* Contract marker not found in database.
*/
function errorMarkerMissing(options) {
	return new CliStructuredError("3001", "Database not signed", {
		domain: "RUN",
		why: options?.why ?? "No database signature (marker) found",
		fix: "Run `prisma-next db sign --db <url>` to sign the database"
	});
}
/**
* Contract hash does not match database marker.
*/
function errorHashMismatch(options) {
	return new CliStructuredError("3002", "Hash mismatch", {
		domain: "RUN",
		why: options?.why ?? "Contract hash does not match database marker",
		fix: "Migrate database or re-sign if intentional",
		...options?.expected !== void 0 || options?.actual !== void 0 ? { meta: {
			...ifDefined("expected", options?.expected),
			...ifDefined("actual", options?.actual)
		} } : {}
	});
}
/**
* Contract target does not match config target.
*/
function errorTargetMismatch(expected, actual, options) {
	return new CliStructuredError("3003", "Target mismatch", {
		domain: "RUN",
		why: options?.why ?? `Contract target does not match config target (expected: ${expected}, actual: ${actual})`,
		fix: "Align contract target and config target",
		meta: {
			expected,
			actual
		}
	});
}
/**
* Database marker is required but not found.
* Used by commands that require a pre-existing marker as a precondition.
*/
function errorMarkerRequired(options) {
	return new CliStructuredError("3010", "Database must be signed first", {
		domain: "RUN",
		why: options?.why ?? "No database signature (marker) found",
		fix: options?.fix ?? "Run `prisma-next db init` first to sign the database"
	});
}
/**
* Schema verification found mismatches between the database and the contract.
* The full verification tree is preserved in `meta.verificationResult`.
*/
function errorSchemaVerificationFailed(options) {
	return new CliStructuredError("3004", options.summary, {
		domain: "RUN",
		why: "Database schema does not satisfy the contract",
		fix: "Run `prisma-next db update` to reconcile, or adjust your contract to match the database",
		meta: {
			verificationResult: options.verificationResult,
			...ifDefined("issues", options.issues)
		}
	});
}
/**
* Migration runner failed during execution.
*/
function errorRunnerFailed(summary, options) {
	return new CliStructuredError("3020", summary, {
		domain: "RUN",
		why: options?.why ?? "Migration runner failed",
		fix: options?.fix ?? "Inspect the reported conflict and reconcile schema drift",
		...options?.meta ? { meta: options.meta } : {}
	});
}
/** Error code for destructive changes that require explicit confirmation. */
const ERROR_CODE_DESTRUCTIVE_CHANGES = "3030";
/**
* Destructive operations require explicit confirmation via -y/--yes.
*/
function errorDestructiveChanges(summary, options) {
	return new CliStructuredError(ERROR_CODE_DESTRUCTIVE_CHANGES, summary, {
		domain: "RUN",
		why: options?.why ?? "Planned operations include destructive changes that require confirmation",
		fix: options?.fix ?? "Re-run with `-y` to apply, or use `--dry-run` to preview first",
		...options?.meta ? { meta: options.meta } : {}
	});
}
/**
* Generic runtime error.
*/
function errorRuntime(summary, options) {
	return new CliStructuredError("3000", summary, {
		domain: "RUN",
		...options?.why ? { why: options.why } : { why: "Verification failed" },
		...options?.fix ? { fix: options.fix } : { fix: "Check contract and database state" },
		...options?.meta ? { meta: options.meta } : {}
	});
}

//#endregion
export { ERROR_CODE_DESTRUCTIVE_CHANGES, errorDestructiveChanges, errorHashMismatch, errorMarkerMissing, errorMarkerRequired, errorRunnerFailed, errorRuntime, errorSchemaVerificationFailed, errorTargetMismatch };
//# sourceMappingURL=execution.mjs.map