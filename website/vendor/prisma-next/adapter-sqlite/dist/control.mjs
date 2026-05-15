import { n as renderLoweredSql } from "./adapter-DjLhS34S.mjs";
import { t as sqliteAdapterDescriptorMeta } from "./descriptor-meta-DYT9Gt_F.mjs";
import { SqlEscapeError, escapeLiteral, quoteIdentifier } from "@prisma-next/target-sqlite/sql-utils";
import { SQLITE_BIGINT_CODEC_ID, SQLITE_BLOB_CODEC_ID, SQLITE_DATETIME_CODEC_ID, SQLITE_INTEGER_CODEC_ID, SQLITE_JSON_CODEC_ID, SQLITE_REAL_CODEC_ID, SQLITE_TEXT_CODEC_ID } from "@prisma-next/target-sqlite/codec-ids";
import { parseContractMarkerRow } from "@prisma-next/family-sql/verify";
import { parseSqliteDefault, parseSqliteDefault as parseSqliteDefault$1 } from "@prisma-next/target-sqlite/default-normalizer";
import { normalizeSqliteNativeType, normalizeSqliteNativeType as normalizeSqliteNativeType$1 } from "@prisma-next/target-sqlite/native-type-normalizer";
import { ifDefined } from "@prisma-next/utils/defined";
import { builtinGeneratorRegistryMetadata, resolveBuiltinGeneratedColumnDescriptor } from "@prisma-next/ids";

//#region src/core/control-adapter.ts
var SqliteControlAdapter = class {
	familyId = "sql";
	targetId = "sqlite";
	normalizeDefault = parseSqliteDefault$1;
	normalizeNativeType = normalizeSqliteNativeType$1;
	/**
	* Lower a SQL query AST into a SQLite-flavored `{ sql, params }` payload.
	*
	* Delegates to the shared `renderLoweredSql` renderer so the control adapter
	* emits byte-identical SQL to `SqliteAdapterImpl.lower()` for the same AST
	* and contract. Used at migration plan/emit time (e.g. by `dataTransform`)
	* without instantiating the runtime adapter.
	*/
	lower(ast, context) {
		return renderLoweredSql(ast, context.contract);
	}
	/**
	* Reads the contract marker from `_prisma_marker`. Probes `sqlite_master`
	* first so a fresh database (no marker table) returns `null` instead of a
	* "no such table" error.
	*/
	async readMarker(driver) {
		if ((await driver.query(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`, ["_prisma_marker"])).rows.length === 0) return null;
		const row = (await driver.query(`SELECT
         core_hash,
         profile_hash,
         contract_json,
         canonical_version,
         updated_at,
         app_tag,
         meta,
         invariants
       FROM _prisma_marker
       WHERE id = ?`, [1])).rows[0];
		if (!row) return null;
		const invariants = typeof row.invariants === "string" ? JSON.parse(row.invariants) : row.invariants;
		return parseContractMarkerRow({
			...row,
			invariants
		});
	}
	async introspect(driver, _contract) {
		const tablesResult = await driver.query(`SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT IN ('_prisma_marker', '_prisma_ledger')
       ORDER BY name`);
		const tables = {};
		for (const tableRow of tablesResult.rows) {
			const tableName = tableRow.name;
			const columnsResult = await driver.query(`PRAGMA table_info("${escapePragmaArg(tableName)}")`);
			const fkResult = await driver.query(`PRAGMA foreign_key_list("${escapePragmaArg(tableName)}")`);
			const indexListResult = await driver.query(`PRAGMA index_list("${escapePragmaArg(tableName)}")`);
			const columns = {};
			const pkColumns = [];
			for (const col of columnsResult.rows) {
				columns[col.name] = {
					name: col.name,
					nativeType: col.type.toLowerCase(),
					nullable: col.notnull === 0 && col.pk === 0,
					...ifDefined("default", col.dflt_value ?? void 0)
				};
				if (col.pk > 0) pkColumns.push({
					name: col.name,
					pk: col.pk
				});
			}
			pkColumns.sort((a, b) => a.pk - b.pk);
			const primaryKey = pkColumns.length > 0 ? { columns: pkColumns.map((c) => c.name) } : void 0;
			const fkMap = /* @__PURE__ */ new Map();
			for (const fk of fkResult.rows) {
				const existing = fkMap.get(fk.id);
				if (existing) {
					existing.columns.push(fk.from);
					existing.referencedColumns.push(fk.to);
				} else fkMap.set(fk.id, {
					columns: [fk.from],
					referencedTable: fk.table,
					referencedColumns: [fk.to],
					onDelete: fk.on_delete,
					onUpdate: fk.on_update
				});
			}
			const foreignKeys = Array.from(fkMap.values()).map((fk) => ({
				columns: Object.freeze([...fk.columns]),
				referencedTable: fk.referencedTable,
				referencedColumns: Object.freeze([...fk.referencedColumns]),
				...ifDefined("onDelete", mapSqliteReferentialAction(fk.onDelete)),
				...ifDefined("onUpdate", mapSqliteReferentialAction(fk.onUpdate))
			}));
			const uniques = [];
			const indexes = [];
			for (const idx of indexListResult.rows) {
				const idxColumns = (await driver.query(`PRAGMA index_info("${escapePragmaArg(idx.name)}")`)).rows.sort((a, b) => a.seqno - b.seqno).map((r) => r.name);
				if (idx.origin === "u") uniques.push({
					columns: Object.freeze([...idxColumns]),
					name: idx.name
				});
				else if (idx.origin === "c") indexes.push({
					columns: Object.freeze([...idxColumns]),
					name: idx.name,
					unique: idx.unique === 1
				});
			}
			tables[tableName] = {
				name: tableName,
				columns,
				...ifDefined("primaryKey", primaryKey),
				foreignKeys,
				uniques,
				indexes
			};
		}
		return {
			tables,
			dependencies: []
		};
	}
};
function escapePragmaArg(name) {
	return name.replace(/"/g, "\"\"");
}
const SQLITE_REFERENTIAL_ACTION_MAP = {
	"NO ACTION": "noAction",
	RESTRICT: "restrict",
	CASCADE: "cascade",
	"SET NULL": "setNull",
	"SET DEFAULT": "setDefault"
};
function mapSqliteReferentialAction(rule) {
	const mapped = SQLITE_REFERENTIAL_ACTION_MAP[rule.toUpperCase()];
	if (mapped === void 0) throw new Error(`Unknown SQLite referential action rule: "${rule}". Expected one of: NO ACTION, RESTRICT, CASCADE, SET NULL, SET DEFAULT.`);
	if (mapped === "noAction") return void 0;
	return mapped;
}

//#endregion
//#region src/core/control-mutation-defaults.ts
function invalidArgumentDiagnostic(input) {
	return {
		ok: false,
		diagnostic: {
			code: "PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT",
			message: input.message,
			sourceId: input.context.sourceId,
			span: input.span
		}
	};
}
function executionGenerator(id, params) {
	return {
		ok: true,
		value: {
			kind: "execution",
			generated: {
				kind: "generator",
				id,
				...params ? { params } : {}
			}
		}
	};
}
function expectNoArgs(input) {
	if (input.call.args.length === 0) return;
	return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.span,
		message: `Default function "${input.call.name}" does not accept arguments. Use ${input.usage}.`
	});
}
function parseIntegerArgument(raw) {
	const trimmed = raw.trim();
	if (!/^-?\d+$/.test(trimmed)) return;
	const value = Number(trimmed);
	if (!Number.isInteger(value)) return;
	return value;
}
function parseStringLiteral(raw) {
	const match = raw.trim().match(/^(['"])(.*)\1$/s);
	if (!match) return;
	return match[2] ?? "";
}
function lowerAutoincrement(input) {
	const maybeNoArgs = expectNoArgs({
		call: input.call,
		context: input.context,
		usage: "`autoincrement()`"
	});
	if (maybeNoArgs) return maybeNoArgs;
	return {
		ok: true,
		value: {
			kind: "storage",
			defaultValue: {
				kind: "function",
				expression: "autoincrement()"
			}
		}
	};
}
function lowerNow(input) {
	const maybeNoArgs = expectNoArgs({
		call: input.call,
		context: input.context,
		usage: "`now()`"
	});
	if (maybeNoArgs) return maybeNoArgs;
	return {
		ok: true,
		value: {
			kind: "storage",
			defaultValue: {
				kind: "function",
				expression: "now()"
			}
		}
	};
}
function lowerUuid(input) {
	if (input.call.args.length === 0) return executionGenerator("uuidv4");
	if (input.call.args.length !== 1) return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.span,
		message: "Default function \"uuid\" accepts at most one version argument: `uuid()`, `uuid(4)`, or `uuid(7)`."
	});
	const version = parseIntegerArgument(input.call.args[0]?.raw ?? "");
	if (version === 4) return executionGenerator("uuidv4");
	if (version === 7) return executionGenerator("uuidv7");
	return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.args[0]?.span ?? input.call.span,
		message: "Default function \"uuid\" supports only `uuid()`, `uuid(4)`, or `uuid(7)` in SQL PSL provider v1."
	});
}
function lowerCuid(input) {
	if (input.call.args.length === 0) return {
		ok: false,
		diagnostic: {
			code: "PSL_UNKNOWN_DEFAULT_FUNCTION",
			message: "Default function \"cuid()\" is not supported in SQL PSL provider v1. Use `cuid(2)` instead.",
			sourceId: input.context.sourceId,
			span: input.call.span
		}
	};
	if (input.call.args.length !== 1) return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.span,
		message: "Default function \"cuid\" accepts exactly one version argument: `cuid(2)`."
	});
	if (parseIntegerArgument(input.call.args[0]?.raw ?? "") === 2) return executionGenerator("cuid2");
	return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.args[0]?.span ?? input.call.span,
		message: "Default function \"cuid\" supports only `cuid(2)` in SQL PSL provider v1."
	});
}
function lowerUlid(input) {
	const maybeNoArgs = expectNoArgs({
		call: input.call,
		context: input.context,
		usage: "`ulid()`"
	});
	if (maybeNoArgs) return maybeNoArgs;
	return executionGenerator("ulid");
}
function lowerNanoid(input) {
	if (input.call.args.length === 0) return executionGenerator("nanoid");
	if (input.call.args.length !== 1) return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.span,
		message: "Default function \"nanoid\" accepts at most one size argument: `nanoid()` or `nanoid(<2-255>)`."
	});
	const size = parseIntegerArgument(input.call.args[0]?.raw ?? "");
	if (size !== void 0 && size >= 2 && size <= 255) return executionGenerator("nanoid", { size });
	return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.args[0]?.span ?? input.call.span,
		message: "Default function \"nanoid\" size argument must be an integer between 2 and 255."
	});
}
/**
* SQLite spellings that all denote the same wall-clock-now value. Anything
* matching this set when passed through `dbgenerated("...")` is rewritten
* to the canonical `now()` form before entering the contract — symmetric
* with `parseSqliteDefault` on the introspection side, so the verifier
* compares canonical-vs-canonical and a contract using
* `dbgenerated("CURRENT_TIMESTAMP")` doesn't drift against the schema it
* just produced.
*/
const NOW_SYNONYMS = new Set([
	"current_timestamp",
	"datetime('now')",
	"datetime(\"now\")",
	"now()"
]);
function lowerDbgenerated(input) {
	if (input.call.args.length !== 1) return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.span,
		message: "Default function \"dbgenerated\" requires exactly one string argument: `dbgenerated(\"...\")`."
	});
	const rawExpression = parseStringLiteral(input.call.args[0]?.raw ?? "");
	if (rawExpression === void 0) return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.args[0]?.span ?? input.call.span,
		message: "Default function \"dbgenerated\" argument must be a string literal."
	});
	const trimmed = rawExpression.trim();
	if (trimmed.length === 0) return invalidArgumentDiagnostic({
		context: input.context,
		span: input.call.args[0]?.span ?? input.call.span,
		message: "Default function \"dbgenerated\" argument cannot be empty."
	});
	return {
		ok: true,
		value: {
			kind: "storage",
			defaultValue: {
				kind: "function",
				expression: NOW_SYNONYMS.has(trimmed.toLowerCase()) ? "now()" : trimmed
			}
		}
	};
}
const sqliteDefaultFunctionRegistryEntries = [
	["autoincrement", {
		lower: lowerAutoincrement,
		usageSignatures: ["autoincrement()"]
	}],
	["now", {
		lower: lowerNow,
		usageSignatures: ["now()"]
	}],
	["uuid", {
		lower: lowerUuid,
		usageSignatures: [
			"uuid()",
			"uuid(4)",
			"uuid(7)"
		]
	}],
	["cuid", {
		lower: lowerCuid,
		usageSignatures: ["cuid(2)"]
	}],
	["ulid", {
		lower: lowerUlid,
		usageSignatures: ["ulid()"]
	}],
	["nanoid", {
		lower: lowerNanoid,
		usageSignatures: ["nanoid()", "nanoid(<2-255>)"]
	}],
	["dbgenerated", {
		lower: lowerDbgenerated,
		usageSignatures: ["dbgenerated(\"...\")"]
	}]
];
const sqliteScalarTypeDescriptors = new Map([
	["String", SQLITE_TEXT_CODEC_ID],
	["Int", SQLITE_INTEGER_CODEC_ID],
	["BigInt", SQLITE_BIGINT_CODEC_ID],
	["Float", SQLITE_REAL_CODEC_ID],
	["Decimal", SQLITE_TEXT_CODEC_ID],
	["DateTime", SQLITE_DATETIME_CODEC_ID],
	["Json", SQLITE_JSON_CODEC_ID],
	["Bytes", SQLITE_BLOB_CODEC_ID]
]);
function createSqliteDefaultFunctionRegistry() {
	return new Map(sqliteDefaultFunctionRegistryEntries);
}
function createSqliteMutationDefaultGeneratorDescriptors() {
	return builtinGeneratorRegistryMetadata.map(({ id, applicableCodecIds }) => ({
		id,
		applicableCodecIds,
		resolveGeneratedColumnDescriptor: ({ generated }) => {
			if (generated.kind !== "generator" || generated.id !== id) return;
			const descriptor = resolveBuiltinGeneratedColumnDescriptor({
				id,
				...generated.params ? { params: generated.params } : {}
			});
			return {
				codecId: descriptor.type.codecId,
				nativeType: descriptor.type.nativeType,
				...descriptor.type.typeRef ? { typeRef: descriptor.type.typeRef } : {},
				...descriptor.typeParams ? { typeParams: descriptor.typeParams } : {}
			};
		}
	}));
}
function createSqliteScalarTypeDescriptors() {
	return new Map(sqliteScalarTypeDescriptors);
}

//#endregion
//#region src/exports/control.ts
const sqliteAdapterDescriptor = {
	...sqliteAdapterDescriptorMeta,
	scalarTypeDescriptors: createSqliteScalarTypeDescriptors(),
	controlMutationDefaults: {
		defaultFunctionRegistry: createSqliteDefaultFunctionRegistry(),
		generatorDescriptors: createSqliteMutationDefaultGeneratorDescriptors()
	},
	create() {
		return new SqliteControlAdapter();
	}
};
var control_default = sqliteAdapterDescriptor;

//#endregion
export { SqlEscapeError, SqliteControlAdapter, control_default as default, escapeLiteral, normalizeSqliteNativeType, parseSqliteDefault, quoteIdentifier };
//# sourceMappingURL=control.mjs.map