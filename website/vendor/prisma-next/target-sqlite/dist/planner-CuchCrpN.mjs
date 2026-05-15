import { t as parseSqliteDefault } from "./default-normalizer-R-sQXAYt.mjs";
import { t as normalizeSqliteNativeType } from "./native-type-normalizer-BMovohPm.mjs";
import { c as buildColumnDefaultSql, l as buildColumnTypeSql, n as buildRecreateSummary, t as buildRecreatePostchecks, u as isInlineAutoincrementPrimaryKey } from "./tables-sKIg_lWE.mjs";
import { a as DropColumnCall, c as RecreateTableCall, i as DataTransformCall, n as CreateIndexCall, o as DropIndexCall, r as CreateTableCall, s as DropTableCall, t as AddColumnCall } from "./op-factory-call-BUVV-W9F.mjs";
import { t as CONTROL_TABLE_NAMES } from "./statement-builders-B3OGOp7n.mjs";
import { t as TypeScriptRenderableSqliteMigration } from "./planner-produced-sqlite-migration-C3AAaQoW.mjs";
import { extractCodecControlHooks, plannerFailure } from "@prisma-next/family-sql/control";
import { verifySqlSchema } from "@prisma-next/family-sql/schema-verify";
import { defaultIndexName } from "@prisma-next/sql-schema-ir/naming";
import { notOk, ok } from "@prisma-next/utils/result";

//#region src/core/migrations/planner-strategies.ts
const WIDENING_ISSUE_KINDS = new Set(["default_mismatch", "default_missing"]);
const DESTRUCTIVE_ISSUE_KINDS = new Set([
	"extra_default",
	"type_mismatch",
	"primary_key_mismatch",
	"foreign_key_mismatch",
	"unique_constraint_mismatch",
	"extra_foreign_key",
	"extra_unique_constraint",
	"extra_primary_key"
]);
function classifyIssue(issue) {
	if (issue.kind === "enum_values_changed") return null;
	if (!issue.table) return null;
	if (issue.kind === "nullability_mismatch") return issue.expected === "true" ? "widening" : "destructive";
	if (WIDENING_ISSUE_KINDS.has(issue.kind)) return "widening";
	if (DESTRUCTIVE_ISSUE_KINDS.has(issue.kind)) return "destructive";
	return null;
}
/**
* Groups recreate-eligible issues by table, decides per-table operation class
* (destructive wins over widening), and emits one `RecreateTableCall` per
* table. Returns unchanged-or-smaller issue list — issues the strategy
* consumed are removed so `mapIssueToCall` doesn't double-handle them.
*/
const recreateTableStrategy = (issues, ctx) => {
	const byTable = /* @__PURE__ */ new Map();
	const consumed = /* @__PURE__ */ new Set();
	for (const issue of issues) {
		const cls = classifyIssue(issue);
		if (!cls) continue;
		if (issue.kind === "enum_values_changed") continue;
		if (!issue.table) continue;
		const table = issue.table;
		const entry = byTable.get(table);
		if (entry) {
			entry.issues.push(issue);
			if (cls === "destructive") entry.hasDestructive = true;
		} else byTable.set(table, {
			issues: [issue],
			hasDestructive: cls === "destructive"
		});
		consumed.add(issue);
	}
	if (byTable.size === 0) return { kind: "no_match" };
	const calls = [];
	for (const [tableName, entry] of byTable) {
		const contractTable = ctx.toContract.storage.tables[tableName];
		const schemaTable = ctx.schema.tables[tableName];
		if (!contractTable || !schemaTable) continue;
		const operationClass = entry.hasDestructive ? "destructive" : "widening";
		const tableSpec = toTableSpec(contractTable, ctx.storageTypes);
		const seenIndexColumnKeys = /* @__PURE__ */ new Set();
		const indexes = [];
		for (const idx of contractTable.indexes) {
			const key = idx.columns.join(",");
			if (seenIndexColumnKeys.has(key)) continue;
			seenIndexColumnKeys.add(key);
			indexes.push({
				name: idx.name ?? defaultIndexName(tableName, idx.columns),
				columns: idx.columns
			});
		}
		for (const fk of contractTable.foreignKeys) {
			if (fk.index === false) continue;
			const key = fk.columns.join(",");
			if (seenIndexColumnKeys.has(key)) continue;
			seenIndexColumnKeys.add(key);
			indexes.push({
				name: defaultIndexName(tableName, fk.columns),
				columns: fk.columns
			});
		}
		calls.push(new RecreateTableCall({
			tableName,
			contractTable: tableSpec,
			schemaColumnNames: Object.keys(schemaTable.columns),
			indexes,
			summary: buildRecreateSummary(tableName, entry.issues),
			postchecks: buildRecreatePostchecks(tableName, entry.issues, tableSpec),
			operationClass
		}));
	}
	return {
		kind: "match",
		issues: issues.filter((i) => !consumed.has(i)),
		calls,
		recipe: true
	};
};
/**
* When the policy allows `'data'` and the contract tightens one or more
* columns from nullable to NOT NULL, emit a `DataTransformCall` stub per
* tightened column. The user fills the backfill `UPDATE` in the rendered
* `migration.ts` before the subsequent `RecreateTableCall` copies data into
* the tightened schema (whose `INSERT INTO temp SELECT … FROM old` would
* otherwise fail at runtime if any `NULL`s remain).
*
* Does NOT consume the tightening issue — `recreateTableStrategy` still
* needs it to produce the actual recreate that enforces the NOT NULL at
* the schema level. The backfill op and the recreate op end up in the
* recipe slot in strategy order (backfill first, recreate second), which
* matches the required execution order.
*
* Mirrors Postgres's `nullableTighteningCallStrategy` / `'data'`-class
* gating. When `'data'` is not in the policy (the default `db update` /
* `db init` path), the strategy short-circuits and the recreate alone
* runs with its current destructive-class gating — preserving today's
* behavior where a tightening blows up at runtime if NULLs are present.
*/
const nullabilityTighteningBackfillStrategy = (issues, ctx) => {
	if (!ctx.policy.allowedOperationClasses.includes("data")) return { kind: "no_match" };
	const calls = [];
	for (const issue of issues) {
		if (issue.kind !== "nullability_mismatch") continue;
		if (!issue.table || !issue.column) continue;
		if (issue.expected === "true") continue;
		const column = ctx.toContract.storage.tables[issue.table]?.columns[issue.column];
		if (!column || column.nullable === true) continue;
		calls.push(new DataTransformCall(`data_migration.backfill-${issue.table}-${issue.column}`, `Backfill NULLs in "${issue.table}"."${issue.column}" before NOT NULL tightening`, issue.table, issue.column));
	}
	if (calls.length === 0) return { kind: "no_match" };
	return {
		kind: "match",
		issues,
		calls,
		recipe: true
	};
};
const sqlitePlannerStrategies = [nullabilityTighteningBackfillStrategy, recreateTableStrategy];

//#endregion
//#region src/core/migrations/issue-planner.ts
const ISSUE_KIND_ORDER = {
	extra_foreign_key: 10,
	extra_unique_constraint: 11,
	extra_primary_key: 12,
	extra_index: 13,
	extra_default: 14,
	extra_column: 15,
	extra_table: 16,
	missing_table: 20,
	missing_column: 30,
	type_mismatch: 40,
	nullability_mismatch: 41,
	default_missing: 42,
	default_mismatch: 43,
	primary_key_mismatch: 50,
	unique_constraint_mismatch: 51,
	index_mismatch: 52,
	foreign_key_mismatch: 60
};
function issueOrder(issue) {
	return ISSUE_KIND_ORDER[issue.kind] ?? 99;
}
function issueKey(issue) {
	return `${"table" in issue && typeof issue.table === "string" ? issue.table : ""}\u0000${"column" in issue && typeof issue.column === "string" ? issue.column : ""}\u0000${"indexOrConstraint" in issue && typeof issue.indexOrConstraint === "string" ? issue.indexOrConstraint : ""}`;
}
function issueConflict(kind, summary, location) {
	return {
		kind,
		summary,
		why: "Use `migration new` to author a custom migration for this change.",
		...location ? { location } : {}
	};
}
function conflictKindForIssue(issue) {
	switch (issue.kind) {
		case "type_mismatch": return "typeMismatch";
		case "nullability_mismatch": return "nullabilityConflict";
		case "primary_key_mismatch":
		case "unique_constraint_mismatch":
		case "index_mismatch":
		case "extra_primary_key":
		case "extra_unique_constraint": return "indexIncompatible";
		case "foreign_key_mismatch":
		case "extra_foreign_key": return "foreignKeyConflict";
		default: return "missingButNonAdditive";
	}
}
function issueLocation(issue) {
	if (issue.kind === "enum_values_changed") return void 0;
	const location = {};
	if (issue.table) location.table = issue.table;
	if (issue.column) location.column = issue.column;
	if (issue.indexOrConstraint) location.constraint = issue.indexOrConstraint;
	return Object.keys(location).length > 0 ? location : void 0;
}
function conflictForDisallowedCall(call, allowed) {
	const summary = `Operation "${call.label}" requires class "${call.operationClass}", but policy allows only: ${allowed.join(", ")}`;
	const location = locationForCall(call);
	return {
		kind: conflictKindForCall(call),
		summary,
		why: "Use `migration new` to author a custom migration for this change.",
		...location ? { location } : {}
	};
}
function conflictKindForCall(call) {
	switch (call.factoryName) {
		case "createIndex":
		case "dropIndex": return "indexIncompatible";
		default: return "missingButNonAdditive";
	}
}
function locationForCall(call) {
	const location = {};
	if ("tableName" in call) location.table = call.tableName;
	if ("columnName" in call) location.column = call.columnName;
	if ("indexName" in call) location.index = call.indexName;
	return Object.keys(location).length > 0 ? location : void 0;
}
function isMissing(issue) {
	if (issue.kind === "enum_values_changed") return false;
	return issue.actual === void 0;
}
/**
* Resolves codec / `typeRef` / default rendering into a flat
* `SqliteColumnSpec`. Mirrors Postgres's `toColumnSpec`. Once a column is
* flattened, downstream Calls and operation factories never see
* `StorageColumn` again — they deal in pre-rendered SQL fragments.
*/
function toColumnSpec(name, column, storageTypes, inlineAutoincrementPrimaryKey = false) {
	return {
		name,
		typeSql: buildColumnTypeSql(column, storageTypes),
		defaultSql: buildColumnDefaultSql(column.default),
		nullable: column.nullable,
		...inlineAutoincrementPrimaryKey ? { inlineAutoincrementPrimaryKey: true } : {}
	};
}
/**
* Flattens a `StorageTable` into a `SqliteTableSpec` ready for
* `CreateTableCall` / `RecreateTableCall`. Sole-column AUTOINCREMENT
* primary keys are detected here and marked on the column spec so the
* renderer emits `INTEGER PRIMARY KEY AUTOINCREMENT` inline.
*/
function toTableSpec(table, storageTypes) {
	const columns = Object.entries(table.columns).map(([name, column]) => toColumnSpec(name, column, storageTypes, isInlineAutoincrementPrimaryKey(table, name)));
	const uniques = table.uniques.map((u) => ({
		columns: u.columns,
		...u.name !== void 0 ? { name: u.name } : {}
	}));
	const foreignKeys = table.foreignKeys.map((fk) => ({
		columns: fk.columns,
		references: {
			table: fk.references.table,
			columns: fk.references.columns
		},
		constraint: fk.constraint !== false,
		...fk.name !== void 0 ? { name: fk.name } : {},
		...fk.onDelete !== void 0 ? { onDelete: fk.onDelete } : {},
		...fk.onUpdate !== void 0 ? { onUpdate: fk.onUpdate } : {}
	}));
	return {
		columns,
		...table.primaryKey ? { primaryKey: { columns: table.primaryKey.columns } } : {},
		uniques,
		foreignKeys
	};
}
const DEFAULT_POLICY = { allowedOperationClasses: [
	"additive",
	"widening",
	"destructive",
	"data"
] };
function emptySchemaIR() {
	return {
		tables: {},
		dependencies: []
	};
}
function mapIssueToCall(issue, ctx) {
	switch (issue.kind) {
		case "missing_table": {
			if (!issue.table) return notOk(issueConflict("unsupportedOperation", "Missing table issue has no table name"));
			const contractTable = ctx.toContract.storage.tables[issue.table];
			if (!contractTable) return notOk(issueConflict("unsupportedOperation", `Table "${issue.table}" reported missing but not found in destination contract`));
			const tableSpec = toTableSpec(contractTable, ctx.storageTypes);
			const calls = [new CreateTableCall(issue.table, tableSpec)];
			const declaredIndexColumnKeys = /* @__PURE__ */ new Set();
			for (const index of contractTable.indexes) {
				const indexName = index.name ?? defaultIndexName(issue.table, index.columns);
				declaredIndexColumnKeys.add(index.columns.join(","));
				calls.push(new CreateIndexCall(issue.table, indexName, index.columns));
			}
			for (const fk of contractTable.foreignKeys) {
				if (fk.index === false) continue;
				if (declaredIndexColumnKeys.has(fk.columns.join(","))) continue;
				const indexName = defaultIndexName(issue.table, fk.columns);
				calls.push(new CreateIndexCall(issue.table, indexName, fk.columns));
			}
			return ok(calls);
		}
		case "missing_column": {
			if (!issue.table || !issue.column) return notOk(issueConflict("unsupportedOperation", "Missing column issue has no table/column name"));
			const column = ctx.toContract.storage.tables[issue.table]?.columns[issue.column];
			if (!column) return notOk(issueConflict("unsupportedOperation", `Column "${issue.table}"."${issue.column}" not in destination contract`));
			const contractTable = ctx.toContract.storage.tables[issue.table];
			const columnSpec = toColumnSpec(issue.column, column, ctx.storageTypes, contractTable ? isInlineAutoincrementPrimaryKey(contractTable, issue.column) : false);
			return ok([new AddColumnCall(issue.table, columnSpec)]);
		}
		case "index_mismatch": {
			if (!issue.table) return notOk(issueConflict("indexIncompatible", "Index issue has no table name"));
			if (!isMissing(issue) || !issue.expected) return notOk(issueConflict("indexIncompatible", `Index on "${issue.table}" differs (expected: ${issue.expected}, actual: ${issue.actual})`, { table: issue.table }));
			const columns = issue.expected.split(", ");
			const contractTable = ctx.toContract.storage.tables[issue.table];
			if (!contractTable) return notOk(issueConflict("unsupportedOperation", `Table "${issue.table}" not found in destination contract`));
			const indexName = contractTable.indexes.find((idx) => idx.columns.join(",") === columns.join(","))?.name ?? defaultIndexName(issue.table, columns);
			return ok([new CreateIndexCall(issue.table, indexName, columns)]);
		}
		case "extra_table":
			if (!issue.table) return notOk(issueConflict("unsupportedOperation", "Extra table issue has no table name"));
			if (CONTROL_TABLE_NAMES.has(issue.table)) return ok([]);
			return ok([new DropTableCall(issue.table)]);
		case "extra_column":
			if (!issue.table || !issue.column) return notOk(issueConflict("unsupportedOperation", "Extra column issue has no table/column name"));
			return ok([new DropColumnCall(issue.table, issue.column)]);
		case "extra_index":
			if (!issue.table || !issue.indexOrConstraint) return notOk(issueConflict("unsupportedOperation", "Extra index issue has no table/index name"));
			return ok([new DropIndexCall(issue.table, issue.indexOrConstraint)]);
		case "enum_values_changed": return notOk(issueConflict("unsupportedOperation", "Received enum_values_changed against a SQLite schema (sql.enums: false) — verifier bug"));
		case "type_mismatch":
		case "nullability_mismatch":
		case "default_mismatch":
		case "default_missing":
		case "extra_default":
		case "primary_key_mismatch":
		case "unique_constraint_mismatch":
		case "foreign_key_mismatch":
		case "extra_foreign_key":
		case "extra_unique_constraint":
		case "extra_primary_key": return notOk(issueConflict(conflictKindForIssue(issue), issue.message, issueLocation(issue)));
		default: return notOk(issueConflict("unsupportedOperation", `Unhandled issue kind: ${issue.kind}`));
	}
}
function classifyCall(call) {
	switch (call.factoryName) {
		case "createTable": return "create-table";
		case "addColumn": return "add-column";
		case "createIndex": return "create-index";
		case "dropColumn": return "drop-column";
		case "dropIndex": return "drop-index";
		case "dropTable": return "drop-table";
		case "recreateTable": return null;
		default: return null;
	}
}
function planIssues(options) {
	const policyProvided = options.policy !== void 0;
	const policy = options.policy ?? DEFAULT_POLICY;
	const schema = options.schema ?? emptySchemaIR();
	const frameworkComponents = options.frameworkComponents ?? [];
	const context = {
		toContract: options.toContract,
		fromContract: options.fromContract,
		codecHooks: options.codecHooks,
		storageTypes: options.storageTypes,
		schema,
		policy,
		frameworkComponents
	};
	const strategies = options.strategies ?? sqlitePlannerStrategies;
	let remaining = options.issues;
	const recipeCalls = [];
	const bucketableCalls = [];
	for (const strategy of strategies) {
		const result = strategy(remaining, context);
		if (result.kind === "match") {
			remaining = result.issues;
			if (result.recipe) recipeCalls.push(...result.calls);
			else bucketableCalls.push(...result.calls);
		}
	}
	const sorted = [...remaining].sort((a, b) => {
		const kindDelta = issueOrder(a) - issueOrder(b);
		if (kindDelta !== 0) return kindDelta;
		const keyA = issueKey(a);
		const keyB = issueKey(b);
		return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
	});
	const defaultCalls = [];
	const conflicts = [];
	for (const issue of sorted) {
		const result = mapIssueToCall(issue, context);
		if (result.ok) defaultCalls.push(...result.value);
		else conflicts.push(result.failure);
	}
	const allowed = policy.allowedOperationClasses;
	let gatedRecipe = recipeCalls;
	let gatedBucketable = bucketableCalls;
	let gatedDefault = defaultCalls;
	if (policyProvided) {
		const sink = (acc) => (call) => {
			if (allowed.includes(call.operationClass)) {
				acc.push(call);
				return;
			}
			conflicts.push(conflictForDisallowedCall(call, allowed));
		};
		const gatedRecipeBucket = [];
		const gatedBucketableBucket = [];
		const gatedDefaultBucket = [];
		recipeCalls.forEach(sink(gatedRecipeBucket));
		bucketableCalls.forEach(sink(gatedBucketableBucket));
		defaultCalls.forEach(sink(gatedDefaultBucket));
		gatedRecipe = gatedRecipeBucket;
		gatedBucketable = gatedBucketableBucket;
		gatedDefault = gatedDefaultBucket;
	}
	if (conflicts.length > 0) return notOk(conflicts);
	const combined = [...gatedDefault, ...gatedBucketable];
	const byCategory = (cat) => combined.filter((c) => classifyCall(c) === cat);
	return ok({ calls: [
		...byCategory("create-table"),
		...byCategory("add-column"),
		...byCategory("create-index"),
		...gatedRecipe,
		...byCategory("drop-column"),
		...byCategory("drop-index"),
		...byCategory("drop-table")
	] });
}

//#endregion
//#region src/core/migrations/planner.ts
function createSqliteMigrationPlanner() {
	return new SqliteMigrationPlanner();
}
/**
* SQLite migration planner — a thin wrapper over `planIssues`.
*
* `plan()` verifies the live schema against the target contract (producing
* `SchemaIssue[]`) and delegates to `planIssues` with the registered
* strategies. Strategies absorb groups of related issues into composite
* recipes (e.g. recreating a table to apply type/nullability/default/
* constraint changes at once); anything not absorbed by a strategy flows
* through `mapIssueToCall` in the issue planner as a one-off call.
*
* FK-backing indexes are surfaced by `verifySqlSchema`'s index expansion
* (see `verify-sql-schema.ts:459-469`), so `mapIssueToCall` handles them
* uniformly alongside user-declared indexes.
*/
var SqliteMigrationPlanner = class {
	plan(options) {
		return this.planSql(options);
	}
	emptyMigration(context) {
		return new TypeScriptRenderableSqliteMigration([], {
			from: context.fromHash,
			to: context.toHash
		});
	}
	planSql(options) {
		const policyResult = this.ensureAdditivePolicy(options.policy);
		if (policyResult) return policyResult;
		const schemaIssues = this.collectSchemaIssues(options);
		const codecHooks = extractCodecControlHooks(options.frameworkComponents);
		const storageTypes = options.contract.storage.types ?? {};
		const result = planIssues({
			issues: schemaIssues,
			toContract: options.contract,
			fromContract: options.fromContract,
			codecHooks,
			storageTypes,
			schema: options.schema,
			policy: options.policy,
			frameworkComponents: options.frameworkComponents,
			strategies: sqlitePlannerStrategies
		});
		if (!result.ok) return plannerFailure(result.failure);
		const destination = {
			storageHash: options.contract.storage.storageHash,
			...options.contract.profileHash !== void 0 ? { profileHash: options.contract.profileHash } : {}
		};
		return {
			kind: "success",
			plan: new TypeScriptRenderableSqliteMigration(result.value.calls, {
				from: options.fromContract?.storage.storageHash ?? null,
				to: options.contract.storage.storageHash
			}, destination)
		};
	}
	ensureAdditivePolicy(policy) {
		if (!policy.allowedOperationClasses.includes("additive")) return plannerFailure([{
			kind: "unsupportedOperation",
			summary: "Migration planner requires additive operations be allowed",
			why: "The planner requires the \"additive\" operation class to be allowed in the policy."
		}]);
		return null;
	}
	collectSchemaIssues(options) {
		const allowed = options.policy.allowedOperationClasses;
		const strict = allowed.includes("widening") || allowed.includes("destructive");
		return verifySqlSchema({
			contract: options.contract,
			schema: options.schema,
			strict,
			typeMetadataRegistry: /* @__PURE__ */ new Map(),
			frameworkComponents: options.frameworkComponents,
			normalizeDefault: parseSqliteDefault,
			normalizeNativeType: normalizeSqliteNativeType
		}).schema.issues;
	}
};

//#endregion
export { createSqliteMigrationPlanner as n, SqliteMigrationPlanner as t };
//# sourceMappingURL=planner-CuchCrpN.mjs.map