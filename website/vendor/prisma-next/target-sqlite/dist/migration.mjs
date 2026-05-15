import { t as buildTargetDetails } from "./planner-target-details-BQIWQlBu.mjs";
import { a as recreateTable, f as addColumn, i as dropTable, m as step, o as createIndex, p as dropColumn, r as createTable, s as dropIndex } from "./tables-sKIg_lWE.mjs";
import { t as SqliteMigration } from "./sqlite-migration-CnLhIrJF.mjs";
import { placeholder } from "@prisma-next/errors/migration";
import { MigrationCLI } from "@prisma-next/cli/migration-cli";

//#region src/core/migrations/operations/data-transform.ts
/**
* User-facing `dataTransform` factory for the SQLite migration authoring
* surface. Invoked directly inside a `migration.ts` file to supply a
* user-authored SQL statement that runs with operation class `'data'`.
*
* Typical use: the planner emits a `DataTransformCall` stub when a NOT NULL
* tightening requires a backfill. The rendered `migration.ts` exposes the
* backfill as a `placeholder("…")` slot the user fills in with an
* `UPDATE … WHERE col IS NULL` statement. The filled-in `dataTransform(...)`
* invocation returns a runnable operation the runner executes before the
* subsequent recreate-table op copies data into the tightened schema.
*/
function dataTransform(opts) {
	return {
		id: opts.id,
		label: opts.label,
		summary: opts.description,
		operationClass: "data",
		target: {
			id: "sqlite",
			details: buildTargetDetails("table", opts.table)
		},
		precheck: [],
		execute: [step(opts.description, opts.run())],
		postcheck: []
	};
}

//#endregion
export { SqliteMigration as Migration, MigrationCLI, addColumn, createIndex, createTable, dataTransform, dropColumn, dropIndex, dropTable, placeholder, recreateTable };
//# sourceMappingURL=migration.mjs.map