import { n as stripOuterParens } from "./default-normalizer-R-sQXAYt.mjs";
import { n as escapeLiteral, r as quoteIdentifier } from "./sql-utils-D3SMPFDD.mjs";
import { t as buildTargetDetails } from "./planner-target-details-BQIWQlBu.mjs";

//#region src/core/migrations/operations/shared.ts
function step(description, sql) {
	return {
		description,
		sql
	};
}
const REFERENTIAL_ACTION_SQL = {
	noAction: "NO ACTION",
	restrict: "RESTRICT",
	cascade: "CASCADE",
	setNull: "SET NULL",
	setDefault: "SET DEFAULT"
};
/**
* Renders a single column's inline DDL fragment within a `CREATE TABLE`
* statement. Honours the `inlineAutoincrementPrimaryKey` flag — SQLite
* treats `INTEGER PRIMARY KEY AUTOINCREMENT` as a special form that aliases
* `rowid`, and the column must not carry a `DEFAULT` or repeat `NOT NULL`.
*/
function renderColumnDefinition(column) {
	const parts = [quoteIdentifier(column.name), column.typeSql];
	if (column.inlineAutoincrementPrimaryKey) parts.push("PRIMARY KEY AUTOINCREMENT");
	else {
		if (column.defaultSql) parts.push(column.defaultSql);
		if (!column.nullable) parts.push("NOT NULL");
	}
	return parts.join(" ");
}
/**
* Renders an inline FOREIGN KEY constraint clause for a `CREATE TABLE`
* body. Returns the empty string when `constraint` is false (the FK is
* tracked at the contract level for index-creation purposes only and must
* not produce DDL).
*/
function renderForeignKeyClause(fk) {
	if (!fk.constraint) return "";
	let sql = `${fk.name ? `CONSTRAINT ${quoteIdentifier(fk.name)} ` : ""}FOREIGN KEY (${fk.columns.map(quoteIdentifier).join(", ")}) REFERENCES ${quoteIdentifier(fk.references.table)} (${fk.references.columns.map(quoteIdentifier).join(", ")})`;
	if (fk.onDelete !== void 0) sql += ` ON DELETE ${REFERENTIAL_ACTION_SQL[fk.onDelete]}`;
	if (fk.onUpdate !== void 0) sql += ` ON UPDATE ${REFERENTIAL_ACTION_SQL[fk.onUpdate]}`;
	return sql;
}

//#endregion
//#region src/core/migrations/operations/columns.ts
function addColumn(tableName, column) {
	const addSql = [
		`ALTER TABLE ${quoteIdentifier(tableName)}`,
		`ADD COLUMN ${quoteIdentifier(column.name)} ${column.typeSql}`,
		column.defaultSql,
		column.nullable ? "" : "NOT NULL"
	].filter(Boolean).join(" ");
	return {
		id: `column.${tableName}.${column.name}`,
		label: `Add column ${column.name} on ${tableName}`,
		summary: `Adds column ${column.name} on ${tableName}`,
		operationClass: "additive",
		target: {
			id: "sqlite",
			details: buildTargetDetails("column", column.name, tableName)
		},
		precheck: [step(`ensure column "${column.name}" is missing`, `SELECT COUNT(*) = 0 FROM pragma_table_info('${escapeLiteral(tableName)}') WHERE name = '${escapeLiteral(column.name)}'`)],
		execute: [step(`add column "${column.name}"`, addSql)],
		postcheck: [step(`verify column "${column.name}" exists`, `SELECT COUNT(*) > 0 FROM pragma_table_info('${escapeLiteral(tableName)}') WHERE name = '${escapeLiteral(column.name)}'`)]
	};
}
function dropColumn(tableName, columnName) {
	return {
		id: `dropColumn.${tableName}.${columnName}`,
		label: `Drop column ${columnName} on ${tableName}`,
		summary: `Drops column ${columnName} on ${tableName} which is not in the contract`,
		operationClass: "destructive",
		target: {
			id: "sqlite",
			details: buildTargetDetails("column", columnName, tableName)
		},
		precheck: [step(`ensure column "${columnName}" exists on "${tableName}"`, `SELECT COUNT(*) > 0 FROM pragma_table_info('${escapeLiteral(tableName)}') WHERE name = '${escapeLiteral(columnName)}'`)],
		execute: [step(`drop column "${columnName}" from "${tableName}"`, `ALTER TABLE ${quoteIdentifier(tableName)} DROP COLUMN ${quoteIdentifier(columnName)}`)],
		postcheck: [step(`verify column "${columnName}" is gone from "${tableName}"`, `SELECT COUNT(*) = 0 FROM pragma_table_info('${escapeLiteral(tableName)}') WHERE name = '${escapeLiteral(columnName)}'`)]
	};
}

//#endregion
//#region src/core/migrations/planner-ddl-builders.ts
const SAFE_NATIVE_TYPE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_ ]*$/;
function assertSafeNativeType(nativeType) {
	if (!SAFE_NATIVE_TYPE_PATTERN.test(nativeType)) throw new Error(`Unsafe native type name in contract: "${nativeType}". Native type names must match /^[a-zA-Z][a-zA-Z0-9_ ]*\$/`);
}
function assertSafeDefaultExpression(expression) {
	if (expression.includes(";") || /--|\/\*|\bSELECT\b/i.test(expression)) throw new Error(`Unsafe default expression in contract: "${expression}". Default expressions must not contain semicolons, SQL comment tokens, or subqueries.`);
}
/**
* Renders the column's DDL type token (e.g. `"INTEGER"`, `"TEXT"`).
* Resolves `typeRef` against `storageTypes` and validates the resulting
* native type against a safe-identifier pattern.
*/
function buildColumnTypeSql(column, storageTypes = {}) {
	const resolved = resolveColumnTypeMetadata(column, storageTypes);
	assertSafeNativeType(resolved.nativeType);
	return resolved.nativeType.toUpperCase();
}
/**
* Renders the column's `DEFAULT …` clause. Returns the empty string when
* there is no default, and also when the default is `autoincrement()` —
* SQLite encodes that as `INTEGER PRIMARY KEY AUTOINCREMENT` inline on the
* column definition, not as a separate DEFAULT.
*/
function buildColumnDefaultSql(columnDefault) {
	if (!columnDefault) return "";
	switch (columnDefault.kind) {
		case "literal": return `DEFAULT ${renderDefaultLiteral(columnDefault.value)}`;
		case "function":
			if (columnDefault.expression === "autoincrement()") return "";
			if (columnDefault.expression === "now()") return "DEFAULT (datetime('now'))";
			assertSafeDefaultExpression(columnDefault.expression);
			return `DEFAULT (${columnDefault.expression})`;
	}
}
function renderDefaultLiteral(value) {
	if (value instanceof Date) return `'${escapeLiteral(value.toISOString())}'`;
	if (typeof value === "string") return `'${escapeLiteral(value)}'`;
	if (typeof value === "number" || typeof value === "bigint") return String(value);
	if (typeof value === "boolean") return value ? "1" : "0";
	if (value === null) return "NULL";
	return `'${escapeLiteral(JSON.stringify(value))}'`;
}
function buildCreateIndexSql(tableName, indexName, columns, unique = false) {
	return `CREATE ${unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(indexName)} ON ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")})`;
}
function buildDropIndexSql(indexName) {
	return `DROP INDEX IF EXISTS ${quoteIdentifier(indexName)}`;
}
/**
* True when the column is rendered inline as `INTEGER PRIMARY KEY
* AUTOINCREMENT`. Requires the column's default to be `autoincrement()` and
* the column to be the sole member of the table's primary key — anything
* else falls back to a separate PRIMARY KEY constraint with a default
* AUTOINCREMENT semantics expressed elsewhere.
*/
function isInlineAutoincrementPrimaryKey(table, columnName) {
	if (table.primaryKey?.columns.length !== 1) return false;
	if (table.primaryKey.columns[0] !== columnName) return false;
	const column = table.columns[columnName];
	return column?.default?.kind === "function" && column.default.expression === "autoincrement()";
}
function resolveColumnTypeMetadata(column, storageTypes) {
	if (!column.typeRef) return column;
	const referencedType = storageTypes[column.typeRef];
	if (!referencedType) throw new Error(`Storage type "${column.typeRef}" referenced by column is not defined in storage.types.`);
	return {
		codecId: referencedType.codecId,
		nativeType: referencedType.nativeType,
		typeParams: referencedType.typeParams
	};
}

//#endregion
//#region src/core/migrations/operations/indexes.ts
function createIndex(tableName, indexName, columns) {
	return {
		id: `index.${tableName}.${indexName}`,
		label: `Create index ${indexName} on ${tableName}`,
		summary: `Creates index ${indexName} on ${tableName}`,
		operationClass: "additive",
		target: {
			id: "sqlite",
			details: buildTargetDetails("index", indexName, tableName)
		},
		precheck: [step(`ensure index "${indexName}" is missing`, `SELECT COUNT(*) = 0 FROM sqlite_master WHERE type = 'index' AND name = '${escapeLiteral(indexName)}'`)],
		execute: [step(`create index "${indexName}"`, buildCreateIndexSql(tableName, indexName, columns))],
		postcheck: [step(`verify index "${indexName}" exists`, `SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'index' AND name = '${escapeLiteral(indexName)}'`)]
	};
}
function dropIndex(tableName, indexName) {
	return {
		id: `dropIndex.${tableName}.${indexName}`,
		label: `Drop index ${indexName} on ${tableName}`,
		summary: `Drops index ${indexName} on ${tableName} which is not in the contract`,
		operationClass: "destructive",
		target: {
			id: "sqlite",
			details: buildTargetDetails("index", indexName, tableName)
		},
		precheck: [step(`ensure index "${indexName}" exists`, `SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'index' AND name = '${escapeLiteral(indexName)}'`)],
		execute: [step(`drop index "${indexName}"`, buildDropIndexSql(indexName))],
		postcheck: [step(`verify index "${indexName}" is gone`, `SELECT COUNT(*) = 0 FROM sqlite_master WHERE type = 'index' AND name = '${escapeLiteral(indexName)}'`)]
	};
}

//#endregion
//#region src/core/migrations/operations/tables.ts
/**
* Renders the body of a `CREATE TABLE <name> ( … )` statement from a flat
* `SqliteTableSpec`. SQLite's `INTEGER PRIMARY KEY AUTOINCREMENT` form is
* inline on the column; the table-level PRIMARY KEY clause is emitted only
* when no column carries `inlineAutoincrementPrimaryKey`.
*/
function renderCreateTableSql(tableName, spec) {
	const columnDefs = spec.columns.map(renderColumnDefinition);
	const constraintDefs = [];
	const hasInlinePk = spec.columns.some((c) => c.inlineAutoincrementPrimaryKey);
	if (spec.primaryKey && !hasInlinePk) constraintDefs.push(`PRIMARY KEY (${spec.primaryKey.columns.map(quoteIdentifier).join(", ")})`);
	for (const u of spec.uniques ?? []) {
		const name = u.name ? `CONSTRAINT ${quoteIdentifier(u.name)} ` : "";
		constraintDefs.push(`${name}UNIQUE (${u.columns.map(quoteIdentifier).join(", ")})`);
	}
	for (const fk of spec.foreignKeys ?? []) {
		const clause = renderForeignKeyClause(fk);
		if (clause) constraintDefs.push(clause);
	}
	const allDefs = [...columnDefs, ...constraintDefs];
	return `CREATE TABLE ${quoteIdentifier(tableName)} (\n  ${allDefs.join(",\n  ")}\n)`;
}
function createTable(tableName, spec) {
	return {
		id: `table.${tableName}`,
		label: `Create table ${tableName}`,
		summary: `Creates table ${tableName} with required columns`,
		operationClass: "additive",
		target: {
			id: "sqlite",
			details: buildTargetDetails("table", tableName)
		},
		precheck: [step(`ensure table "${tableName}" does not exist`, `SELECT COUNT(*) = 0 FROM sqlite_master WHERE type = 'table' AND name = '${escapeLiteral(tableName)}'`)],
		execute: [step(`create table "${tableName}"`, renderCreateTableSql(tableName, spec))],
		postcheck: [step(`verify table "${tableName}" exists`, `SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = '${escapeLiteral(tableName)}'`)]
	};
}
function dropTable(tableName) {
	return {
		id: `dropTable.${tableName}`,
		label: `Drop table ${tableName}`,
		summary: `Drops table ${tableName} which is not in the contract`,
		operationClass: "destructive",
		target: {
			id: "sqlite",
			details: buildTargetDetails("table", tableName)
		},
		precheck: [step(`ensure table "${tableName}" exists`, `SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = '${escapeLiteral(tableName)}'`)],
		execute: [step(`drop table "${tableName}"`, `DROP TABLE ${quoteIdentifier(tableName)}`)],
		postcheck: [step(`verify table "${tableName}" is gone`, `SELECT COUNT(*) = 0 FROM sqlite_master WHERE type = 'table' AND name = '${escapeLiteral(tableName)}'`)]
	};
}
function recreateTable(args) {
	const { tableName, contractTable, schemaColumnNames, indexes, summary, postchecks, operationClass } = args;
	const tempName = `_prisma_new_${tableName}`;
	const liveSet = new Set(schemaColumnNames);
	const sharedColumns = contractTable.columns.filter((c) => liveSet.has(c.name)).map((c) => c.name);
	const columnList = sharedColumns.map(quoteIdentifier).join(", ");
	const indexStatements = indexes.map((idx) => ({
		description: `recreate index "${idx.name}" on "${tableName}"`,
		sql: buildCreateIndexSql(tableName, idx.name, idx.columns)
	}));
	const copyStep = sharedColumns.length > 0 ? [step(`copy data from "${tableName}" to "${tempName}"`, `INSERT INTO ${quoteIdentifier(tempName)} (${columnList}) SELECT ${columnList} FROM ${quoteIdentifier(tableName)}`)] : [];
	return {
		id: `recreateTable.${tableName}`,
		label: `Recreate table ${tableName}`,
		summary,
		operationClass,
		target: {
			id: "sqlite",
			details: buildTargetDetails("table", tableName)
		},
		precheck: [step(`ensure table "${tableName}" exists`, `SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = '${escapeLiteral(tableName)}'`), step(`ensure temp table "${tempName}" does not exist`, `SELECT COUNT(*) = 0 FROM sqlite_master WHERE type = 'table' AND name = '${escapeLiteral(tempName)}'`)],
		execute: [
			step(`create new table "${tempName}" with desired schema`, renderCreateTableSql(tempName, contractTable)),
			...copyStep,
			step(`drop old table "${tableName}"`, `DROP TABLE ${quoteIdentifier(tableName)}`),
			step(`rename "${tempName}" to "${tableName}"`, `ALTER TABLE ${quoteIdentifier(tempName)} RENAME TO ${quoteIdentifier(tableName)}`),
			...indexStatements
		],
		postcheck: [
			step(`verify table "${tableName}" exists`, `SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = '${escapeLiteral(tableName)}'`),
			step(`verify temp table "${tempName}" is gone`, `SELECT COUNT(*) = 0 FROM sqlite_master WHERE type = 'table' AND name = '${escapeLiteral(tempName)}'`),
			...postchecks
		]
	};
}
/**
* Build a one-line summary of a recreate-table operation from the schema
* issues that triggered it. Lives next to `recreateTable` so the planner
* (which has the issues) can produce the same description the factory
* used to build inline. Keeping the formatting target-side keeps
* `RecreateTableCall` issue-free at the IR layer.
*/
function buildRecreateSummary(tableName, issues) {
	return `Recreates table ${tableName} to apply schema changes: ${issues.map((i) => i.message).join("; ")}`;
}
const COLUMN_LEVEL_ISSUE_KINDS = new Set([
	"nullability_mismatch",
	"default_mismatch",
	"default_missing",
	"extra_default",
	"type_mismatch"
]);
const PK_ISSUE_KINDS = new Set(["primary_key_mismatch", "extra_primary_key"]);
const UNIQUE_ISSUE_KINDS = new Set(["unique_constraint_mismatch", "extra_unique_constraint"]);
const FK_ISSUE_KINDS = new Set(["foreign_key_mismatch", "extra_foreign_key"]);
/**
* Returns the columns the contract expects as the table's primary key. Picks
* up SQLite's inline `INTEGER PRIMARY KEY AUTOINCREMENT` form when no
* explicit `primaryKey` clause is set on the spec.
*/
function expectedPrimaryKeyColumns(spec) {
	if (spec.primaryKey) return spec.primaryKey.columns;
	const inlinePk = spec.columns.find((c) => c.inlineAutoincrementPrimaryKey);
	return inlinePk ? [inlinePk.name] : [];
}
function quoteSqlList(values) {
	return values.map((v) => `'${escapeLiteral(v)}'`).join(", ");
}
/**
* Per-issue postchecks verifying the recreated table's shape against the
* contract spec. Column-level issues (`nullability_mismatch`,
* `default_mismatch`, …) emit one targeted check each; constraint-level
* issues (`primary_key_mismatch`, `unique_constraint_mismatch`,
* `foreign_key_mismatch`, plus their `extra_*` siblings) emit one
* `pragma_*`-driven check per declared constraint in the contract spec, so
* a recreated table with the right columns but the wrong PK / unique / FK
* shape fails the postcheck instead of passing silently. Exported so the
* planner can pre-build the list at construction time and
* `RecreateTableCall` doesn't have to carry `SchemaIssue` objects through
* to render time.
*/
function buildRecreatePostchecks(tableName, issues, spec) {
	const checks = [];
	const t = escapeLiteral(tableName);
	const byName = new Map(spec.columns.map((c) => [c.name, c]));
	for (const issue of issues) {
		if (issue.kind === "enum_values_changed") continue;
		if (!COLUMN_LEVEL_ISSUE_KINDS.has(issue.kind)) continue;
		if (!issue.column) continue;
		const c = escapeLiteral(issue.column);
		if (issue.kind === "nullability_mismatch") {
			let wantNotNull;
			if (issue.expected === "false") wantNotNull = true;
			else if (issue.expected === "true") wantNotNull = false;
			if (wantNotNull !== void 0) checks.push({
				description: `verify "${issue.column}" nullability on "${tableName}"`,
				sql: `SELECT COUNT(*) > 0 FROM pragma_table_info('${t}') WHERE name = '${c}' AND "notnull" = ${wantNotNull ? 1 : 0}`
			});
		}
		if (issue.kind === "default_mismatch" || issue.kind === "default_missing") {
			const colSpec = byName.get(issue.column);
			const expectedRaw = colSpec?.defaultSql.startsWith("DEFAULT ") ? stripOuterParens(colSpec.defaultSql.slice(8)) : null;
			if (expectedRaw) checks.push({
				description: `verify "${issue.column}" default on "${tableName}"`,
				sql: `SELECT COUNT(*) > 0 FROM pragma_table_info('${t}') WHERE name = '${c}' AND dflt_value = '${escapeLiteral(expectedRaw)}'`
			});
		}
		if (issue.kind === "type_mismatch") {
			const colSpec = byName.get(issue.column);
			if (colSpec) checks.push({
				description: `verify "${issue.column}" type on "${tableName}"`,
				sql: `SELECT COUNT(*) > 0 FROM pragma_table_info('${t}') WHERE name = '${c}' AND LOWER(type) = '${escapeLiteral(colSpec.typeSql.toLowerCase())}'`
			});
		}
		if (issue.kind === "extra_default") checks.push({
			description: `verify "${issue.column}" has no default on "${tableName}"`,
			sql: `SELECT COUNT(*) > 0 FROM pragma_table_info('${t}') WHERE name = '${c}' AND dflt_value IS NULL`
		});
	}
	const hasPkIssue = issues.some((i) => PK_ISSUE_KINDS.has(i.kind));
	const hasUniqueIssue = issues.some((i) => UNIQUE_ISSUE_KINDS.has(i.kind));
	const hasFkIssue = issues.some((i) => FK_ISSUE_KINDS.has(i.kind));
	if (hasPkIssue) {
		const pkColumns = expectedPrimaryKeyColumns(spec);
		const colCount = pkColumns.length;
		if (colCount === 0) checks.push({
			description: `verify "${tableName}" has no primary key`,
			sql: `SELECT (SELECT COUNT(*) FROM pragma_table_info('${t}') WHERE pk > 0) = 0`
		});
		else checks.push({
			description: `verify primary key on "${tableName}"`,
			sql: `SELECT (SELECT COUNT(*) FROM pragma_table_info('${t}') WHERE pk > 0) = ${colCount} AND (SELECT COUNT(*) FROM pragma_table_info('${t}') WHERE pk > 0 AND name IN (${quoteSqlList(pkColumns)})) = ${colCount}`
		});
	}
	if (hasUniqueIssue) for (const u of spec.uniques ?? []) {
		const colCount = u.columns.length;
		const description = u.name ? `verify unique constraint "${u.name}" on "${tableName}"` : `verify unique constraint (${u.columns.join(", ")}) on "${tableName}"`;
		checks.push({
			description,
			sql: `SELECT EXISTS (SELECT 1 FROM pragma_index_list('${t}') l WHERE l."unique" = 1 AND (SELECT COUNT(*) FROM pragma_index_info(l.name)) = ${colCount} AND (SELECT COUNT(*) FROM pragma_index_info(l.name) WHERE name IN (${quoteSqlList(u.columns)})) = ${colCount})`
		});
	}
	if (hasFkIssue) for (const fk of spec.foreignKeys ?? []) {
		const refTable = escapeLiteral(fk.references.table);
		const colCount = fk.columns.length;
		const tuples = fk.columns.map((from, i) => {
			const to = fk.references.columns[i] ?? from;
			return `('${escapeLiteral(from)}', '${escapeLiteral(to)}')`;
		}).join(", ");
		const description = `verify foreign key (${fk.columns.join(", ")}) → ${fk.references.table}(${fk.references.columns.join(", ")}) on "${tableName}"`;
		checks.push({
			description,
			sql: `SELECT EXISTS (SELECT 1 FROM pragma_foreign_key_list('${t}') f WHERE f."table" = '${refTable}' GROUP BY f.id HAVING COUNT(*) = ${colCount} AND SUM(CASE WHEN (f."from", f."to") IN (${tuples}) THEN 1 ELSE 0 END) = ${colCount})`
		});
	}
	return checks;
}

//#endregion
export { recreateTable as a, buildColumnDefaultSql as c, renderDefaultLiteral as d, addColumn as f, dropTable as i, buildColumnTypeSql as l, step as m, buildRecreateSummary as n, createIndex as o, dropColumn as p, createTable as r, dropIndex as s, buildRecreatePostchecks as t, isInlineAutoincrementPrimaryKey as u };
//# sourceMappingURL=tables-sKIg_lWE.mjs.map