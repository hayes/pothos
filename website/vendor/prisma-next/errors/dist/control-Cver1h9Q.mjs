//#region src/control.ts
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
const CLI_ERROR_DOMAINS = [
	"CLI",
	"RUN",
	"MIG",
	"CON",
	"SCHEMA"
];
/**
* Structured CLI error that contains all information needed for error envelopes.
* Call sites throw these errors with full context.
*/
var CliStructuredError = class extends Error {
	code;
	domain;
	severity;
	why;
	fix;
	where;
	meta;
	docsUrl;
	constructor(code, summary, options) {
		super(summary);
		this.name = "CliStructuredError";
		this.code = code;
		this.domain = options?.domain ?? "CLI";
		this.severity = options?.severity ?? "error";
		this.why = options?.why;
		this.fix = options?.fix === options?.why ? void 0 : options?.fix;
		this.where = options?.where ? {
			path: options.where.path,
			line: options.where.line
		} : void 0;
		this.meta = options?.meta;
		this.docsUrl = options?.docsUrl;
	}
	/**
	* Converts this error to a CLI error envelope for output formatting.
	*/
	toEnvelope() {
		return {
			ok: false,
			code: `PN-${this.domain}-${this.code}`,
			domain: this.domain,
			severity: this.severity,
			summary: this.message,
			why: this.why,
			fix: this.fix,
			where: this.where,
			meta: this.meta,
			docsUrl: this.docsUrl
		};
	}
	/**
	* Type guard to check if an error is a CliStructuredError.
	* Uses duck-typing to work across module boundaries where instanceof may fail.
	*/
	static is(error) {
		if (!(error instanceof Error)) return false;
		const candidate = error;
		return candidate.name === "CliStructuredError" && typeof candidate.code === "string" && isCliErrorDomain(candidate.domain) && typeof candidate.toEnvelope === "function";
	}
};
const CLI_ERROR_DOMAIN_SET = new Set(CLI_ERROR_DOMAINS);
function isCliErrorDomain(value) {
	return typeof value === "string" && CLI_ERROR_DOMAIN_SET.has(value);
}
/**
* Config file not found or missing.
*/
function errorConfigFileNotFound(configPath, options) {
	return new CliStructuredError("4001", "Config file not found", {
		domain: "CLI",
		...options?.why ? { why: options.why } : { why: "Config file not found" },
		fix: "Run 'prisma-next init' to create a config file",
		docsUrl: "https://prisma-next.dev/docs/cli/config",
		...configPath ? { where: { path: configPath } } : {}
	});
}
/**
* Contract configuration missing from config.
*/
function errorContractConfigMissing(options) {
	return new CliStructuredError("4002", "Contract configuration missing", {
		domain: "CLI",
		why: options?.why ?? "The contract configuration is required for emit",
		fix: "Add contract configuration to your prisma-next.config.ts",
		docsUrl: "https://prisma-next.dev/docs/cli/contract-emit"
	});
}
/**
* Contract validation failed.
*/
function errorContractValidationFailed(reason, options) {
	return new CliStructuredError("4003", "Contract validation failed", {
		domain: "CLI",
		why: reason,
		fix: "Re-run `prisma-next contract emit`, or fix the contract file and try again",
		docsUrl: "https://prisma-next.dev/docs/contracts",
		...options?.where ? { where: options.where } : {}
	});
}
/**
* File not found.
*/
function errorFileNotFound(filePath, options) {
	return new CliStructuredError("4004", "File not found", {
		domain: "CLI",
		why: options?.why ?? `File not found: ${filePath}`,
		fix: options?.fix ?? "Check that the file path is correct",
		where: { path: filePath },
		...options?.docsUrl ? { docsUrl: options.docsUrl } : {}
	});
}
/**
* Database connection is required but not provided.
*/
function errorDatabaseConnectionRequired(options) {
	const runHint = options?.retryCommand ? `Run \`${options.retryCommand}\`` : options?.commandName ? `Run \`prisma-next ${options.commandName} --db <url>\`` : "Provide `--db <url>`";
	return new CliStructuredError("4005", "Database connection is required", {
		domain: "CLI",
		why: options?.why ?? "Database connection is required for this command",
		fix: `${runHint}, or set \`db: { connection: "postgres://…" }\` in prisma-next.config.ts`
	});
}
/**
* Query runner factory is required but not provided in config.
*/
function errorQueryRunnerFactoryRequired(options) {
	return new CliStructuredError("4006", "Query runner factory is required", {
		domain: "CLI",
		why: options?.why ?? "Config.db.queryRunnerFactory is required for db verify",
		fix: "Add db.queryRunnerFactory to prisma-next.config.ts",
		docsUrl: "https://prisma-next.dev/docs/cli/db-verify"
	});
}
/**
* Family verify.readMarker is required but not provided.
*/
function errorFamilyReadMarkerSqlRequired(options) {
	return new CliStructuredError("4007", "Family readMarker() is required", {
		domain: "CLI",
		why: options?.why ?? "Family verify.readMarker is required for db verify",
		fix: "Ensure family.verify.readMarker() is exported by your family package",
		docsUrl: "https://prisma-next.dev/docs/cli/db-verify"
	});
}
/**
* JSON output format not supported.
*/
function errorJsonFormatNotSupported(options) {
	return new CliStructuredError("4008", "Unsupported JSON format", {
		domain: "CLI",
		why: `The ${options.command} command does not support --json ${options.format}`,
		fix: `Use --json ${options.supportedFormats.join(" or ")}, or omit --json for human output`,
		meta: {
			command: options.command,
			format: options.format,
			supportedFormats: options.supportedFormats
		}
	});
}
/**
* Driver is required for DB-connected commands but not provided.
*/
function errorDriverRequired(options) {
	return new CliStructuredError("4010", "Driver is required for DB-connected commands", {
		domain: "CLI",
		why: options?.why ?? "Config.driver is required for DB-connected commands",
		fix: "Add a control-plane driver to prisma-next.config.ts (e.g. import a driver descriptor and set `driver: postgresDriver`)",
		docsUrl: "https://prisma-next.dev/docs/cli/config"
	});
}
/**
* Contract requires extension packs that are not provided by config descriptors.
*/
function errorContractMissingExtensionPacks(options) {
	const missing = [...options.missingExtensionPacks].sort();
	return new CliStructuredError("4011", "Missing extension packs in config", {
		domain: "CLI",
		why: missing.length === 1 ? `Contract requires extension pack '${missing[0]}', but CLI config does not provide a matching descriptor.` : `Contract requires extension packs ${missing.map((p) => `'${p}'`).join(", ")}, but CLI config does not provide matching descriptors.`,
		fix: "Add the missing extension descriptors to `extensions` in prisma-next.config.ts",
		docsUrl: "https://prisma-next.dev/docs/cli/config",
		meta: {
			missingExtensionPacks: missing,
			providedComponentIds: [...options.providedComponentIds].sort()
		}
	});
}
/**
* Migration planning failed due to conflicts.
*/
function errorMigrationPlanningFailed(options) {
	const conflictSummaries = options.conflicts.map((c) => c.summary);
	const computedWhy = options.why ?? conflictSummaries.join("\n");
	const conflictFixes = options.conflicts.map((c) => c.why).filter((why) => typeof why === "string");
	return new CliStructuredError("4020", "Migration planning failed", {
		domain: "CLI",
		why: computedWhy,
		fix: conflictFixes.length > 0 ? conflictFixes.join("\n") : "Use `db verify --schema-only` to inspect conflicts, or ensure the database is empty",
		meta: { conflicts: options.conflicts },
		docsUrl: "https://prisma-next.dev/docs/cli/db-init"
	});
}
/**
* Target does not support migrations (missing createPlanner/createRunner).
*/
function errorTargetMigrationNotSupported(options) {
	return new CliStructuredError("4021", "Target does not support migrations", {
		domain: "CLI",
		why: options?.why ?? "The configured target does not provide migration planner/runner",
		fix: "Select a target that provides migrations (it must export `target.migrations` for db init)",
		docsUrl: "https://prisma-next.dev/docs/cli/db-init"
	});
}
/**
* The migration-file CLI received `--config` without a path argument (either
* a bare trailing `--config`, or `--config` followed by another flag like
* `--config --dry-run`). Surfacing this as a structured error fails fast
* rather than silently consuming the next flag as the config path or
* falling back to default discovery against the wrong project.
*/
function errorMigrationCliInvalidConfigArg(options) {
	return new CliStructuredError("4012", "--config flag requires a path argument", {
		domain: "CLI",
		why: options?.nextToken !== void 0 ? `\`--config\` was followed by another flag (\`${options.nextToken}\`) instead of a path argument.` : "`--config` was passed without a following path argument.",
		fix: "Pass a config path: `--config <path>` or `--config=<path>`.",
		meta: options?.nextToken !== void 0 ? { nextToken: options.nextToken } : {}
	});
}
/**
* The migration-file CLI received a flag it does not recognise. Surfaced as a
* structured error so consumers can render their own "did you mean"
* suggestions from `meta.knownFlags` rather than parsing the message.
*
* Designed to wrap clipanion's `UnknownSyntaxError` at the parser boundary:
* pass the offending token as `flag` and the option declarations as
* `knownFlags`.
*/
function errorMigrationCliUnknownFlag(options) {
	const knownList = options.knownFlags.join(", ");
	return new CliStructuredError("4013", "Unknown migration CLI flag", {
		domain: "CLI",
		why: `Unknown flag \`${options.flag}\`.`,
		fix: `Known flags: ${knownList}. Run with \`--help\` to see the full list.`,
		meta: {
			flag: options.flag,
			knownFlags: options.knownFlags
		}
	});
}
/**
* Config validation error (missing required fields).
*/
function errorConfigValidation(field, options) {
	return new CliStructuredError("4009", "Config validation error", {
		domain: "CLI",
		why: options?.why ?? `Config must have a "${field}" field`,
		fix: "Check your prisma-next.config.ts and ensure all required fields are provided",
		docsUrl: "https://prisma-next.dev/docs/cli/config"
	});
}
/**
* Generic unexpected error.
*/
function errorUnexpected(message, options) {
	return new CliStructuredError("4999", "Unexpected error", {
		domain: "CLI",
		why: options?.why ?? message,
		fix: options?.fix ?? "Check the error message and try again"
	});
}

//#endregion
export { errorUnexpected as _, errorContractMissingExtensionPacks as a, errorDriverRequired as c, errorJsonFormatNotSupported as d, errorMigrationCliInvalidConfigArg as f, errorTargetMigrationNotSupported as g, errorQueryRunnerFactoryRequired as h, errorContractConfigMissing as i, errorFamilyReadMarkerSqlRequired as l, errorMigrationPlanningFailed as m, errorConfigFileNotFound as n, errorContractValidationFailed as o, errorMigrationCliUnknownFlag as p, errorConfigValidation as r, errorDatabaseConnectionRequired as s, CliStructuredError as t, errorFileNotFound as u };
//# sourceMappingURL=control-Cver1h9Q.mjs.map