import { a as recreateTable, f as addColumn, i as dropTable, o as createIndex, p as dropColumn, r as createTable, s as dropIndex } from "./tables-sKIg_lWE.mjs";
import { errorUnfilledPlaceholder } from "@prisma-next/errors/migration";
import { TsExpression, jsonToTsSource } from "@prisma-next/ts-render";

//#region src/core/migrations/op-factory-call.ts
/**
* SQLite migration IR: one concrete `*Call` class per pure factory under
* `operations/`, plus a shared `SqliteOpFactoryCallNode` abstract base.
*
* Each call class carries fully-resolved literal arguments (flat
* `SqliteColumnSpec` / `SqliteTableSpec` etc.) — codec / `typeRef` / default
* expansion happens upstream in the issue-planner / strategies, mirroring
* the Postgres `ColumnSpec` pattern. As a result, `toOp()` and
* `renderTypeScript()` both pass the same flat data through; the rendered
* TypeScript scaffold is fully self-contained and does not need access to a
* `storageTypes` map at runtime.
*/
const TARGET_MIGRATION_MODULE = "@prisma-next/target-sqlite/migration";
var SqliteOpFactoryCallNode = class extends TsExpression {
	importRequirements() {
		return [{
			moduleSpecifier: TARGET_MIGRATION_MODULE,
			symbol: this.factoryName
		}];
	}
	freeze() {
		Object.freeze(this);
	}
};
var CreateTableCall = class extends SqliteOpFactoryCallNode {
	factoryName = "createTable";
	operationClass = "additive";
	tableName;
	spec;
	label;
	constructor(tableName, spec) {
		super();
		this.tableName = tableName;
		this.spec = spec;
		this.label = `Create table ${tableName}`;
		this.freeze();
	}
	toOp() {
		return createTable(this.tableName, this.spec);
	}
	renderTypeScript() {
		return `createTable(${jsonToTsSource(this.tableName)}, ${jsonToTsSource(this.spec)})`;
	}
};
var DropTableCall = class extends SqliteOpFactoryCallNode {
	factoryName = "dropTable";
	operationClass = "destructive";
	tableName;
	label;
	constructor(tableName) {
		super();
		this.tableName = tableName;
		this.label = `Drop table ${tableName}`;
		this.freeze();
	}
	toOp() {
		return dropTable(this.tableName);
	}
	renderTypeScript() {
		return `dropTable(${jsonToTsSource(this.tableName)})`;
	}
};
var RecreateTableCall = class extends SqliteOpFactoryCallNode {
	factoryName = "recreateTable";
	operationClass;
	tableName;
	contractTable;
	schemaColumnNames;
	indexes;
	summary;
	postchecks;
	label;
	constructor(args) {
		super();
		this.tableName = args.tableName;
		this.contractTable = args.contractTable;
		this.schemaColumnNames = args.schemaColumnNames;
		this.indexes = args.indexes;
		this.summary = args.summary;
		this.postchecks = args.postchecks;
		this.operationClass = args.operationClass;
		this.label = `Recreate table ${args.tableName}`;
		this.freeze();
	}
	toOp() {
		return recreateTable({
			tableName: this.tableName,
			contractTable: this.contractTable,
			schemaColumnNames: this.schemaColumnNames,
			indexes: this.indexes,
			summary: this.summary,
			postchecks: this.postchecks,
			operationClass: this.operationClass
		});
	}
	renderTypeScript() {
		return `recreateTable(${jsonToTsSource({
			tableName: this.tableName,
			contractTable: this.contractTable,
			schemaColumnNames: this.schemaColumnNames,
			indexes: this.indexes,
			summary: this.summary,
			postchecks: this.postchecks,
			operationClass: this.operationClass
		})})`;
	}
};
var AddColumnCall = class extends SqliteOpFactoryCallNode {
	factoryName = "addColumn";
	operationClass = "additive";
	tableName;
	columnName;
	column;
	label;
	constructor(tableName, column) {
		super();
		this.tableName = tableName;
		this.columnName = column.name;
		this.column = column;
		this.label = `Add column ${column.name} on ${tableName}`;
		this.freeze();
	}
	toOp() {
		return addColumn(this.tableName, this.column);
	}
	renderTypeScript() {
		return `addColumn(${jsonToTsSource(this.tableName)}, ${jsonToTsSource(this.column)})`;
	}
};
var DropColumnCall = class extends SqliteOpFactoryCallNode {
	factoryName = "dropColumn";
	operationClass = "destructive";
	tableName;
	columnName;
	label;
	constructor(tableName, columnName) {
		super();
		this.tableName = tableName;
		this.columnName = columnName;
		this.label = `Drop column ${columnName} on ${tableName}`;
		this.freeze();
	}
	toOp() {
		return dropColumn(this.tableName, this.columnName);
	}
	renderTypeScript() {
		return `dropColumn(${jsonToTsSource(this.tableName)}, ${jsonToTsSource(this.columnName)})`;
	}
};
var CreateIndexCall = class extends SqliteOpFactoryCallNode {
	factoryName = "createIndex";
	operationClass = "additive";
	tableName;
	indexName;
	columns;
	label;
	constructor(tableName, indexName, columns) {
		super();
		this.tableName = tableName;
		this.indexName = indexName;
		this.columns = columns;
		this.label = `Create index ${indexName} on ${tableName}`;
		this.freeze();
	}
	toOp() {
		return createIndex(this.tableName, this.indexName, this.columns);
	}
	renderTypeScript() {
		return `createIndex(${jsonToTsSource(this.tableName)}, ${jsonToTsSource(this.indexName)}, ${jsonToTsSource(this.columns)})`;
	}
};
var DropIndexCall = class extends SqliteOpFactoryCallNode {
	factoryName = "dropIndex";
	operationClass = "destructive";
	tableName;
	indexName;
	label;
	constructor(tableName, indexName) {
		super();
		this.tableName = tableName;
		this.indexName = indexName;
		this.label = `Drop index ${indexName} on ${tableName}`;
		this.freeze();
	}
	toOp() {
		return dropIndex(this.tableName, this.indexName);
	}
	renderTypeScript() {
		return `dropIndex(${jsonToTsSource(this.tableName)}, ${jsonToTsSource(this.indexName)})`;
	}
};
/**
* A planner-generated data-transform stub. The current default strategy
* (`nullabilityTighteningBackfillStrategy`) emits one of these with a
* backfill-flavored `id`/`label` when the policy allows `'data'` and the
* contract tightens a column's nullability, but the op itself is generic —
* any future strategy that needs a placeholder data step can construct one
* with its own id/label.
*
* `toOp()` always throws `PN-MIG-2001`: the planner cannot lower a stubbed
* transform to a runtime op — the user must edit the rendered
* `migration.ts` and re-emit.
*/
var DataTransformCall = class extends SqliteOpFactoryCallNode {
	factoryName = "dataTransform";
	operationClass = "data";
	id;
	label;
	tableName;
	columnName;
	constructor(id, label, tableName, columnName) {
		super();
		this.id = id;
		this.label = label;
		this.tableName = tableName;
		this.columnName = columnName;
		this.freeze();
	}
	toOp() {
		throw errorUnfilledPlaceholder(this.label);
	}
	renderTypeScript() {
		const slot = `${this.tableName}-${this.columnName}-backfill-sql`;
		return [
			"dataTransform({",
			`  id: ${jsonToTsSource(this.id)},`,
			`  label: ${jsonToTsSource(this.label)},`,
			`  table: ${jsonToTsSource(this.tableName)},`,
			`  description: ${jsonToTsSource(`Backfill NULL ${this.columnName} values in ${this.tableName}`)},`,
			`  run: () => placeholder(${jsonToTsSource(slot)}),`,
			"})"
		].join("\n");
	}
	importRequirements() {
		return [{
			moduleSpecifier: TARGET_MIGRATION_MODULE,
			symbol: this.factoryName
		}, {
			moduleSpecifier: TARGET_MIGRATION_MODULE,
			symbol: "placeholder"
		}];
	}
};

//#endregion
export { DropColumnCall as a, RecreateTableCall as c, DataTransformCall as i, CreateIndexCall as n, DropIndexCall as o, CreateTableCall as r, DropTableCall as s, AddColumnCall as t };
//# sourceMappingURL=op-factory-call-BUVV-W9F.mjs.map