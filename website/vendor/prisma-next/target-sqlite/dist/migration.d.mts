import { i as SqliteTableSpec, n as SqliteColumnSpec, r as SqliteIndexSpec, t as Op } from "./shared-BNtoZqdo.mjs";
import { t as SqliteMigration } from "./sqlite-migration-BYgrMZdR.mjs";
import { MigrationOperationClass } from "@prisma-next/family-sql/control";
import { placeholder } from "@prisma-next/errors/migration";
import { MigrationCLI } from "@prisma-next/cli/migration-cli";

//#region src/core/migrations/operations/columns.d.ts
declare function addColumn(tableName: string, column: SqliteColumnSpec): Op;
declare function dropColumn(tableName: string, columnName: string): Op;
//#endregion
//#region src/core/migrations/operations/data-transform.d.ts

interface DataTransformOptions {
  /** Stable id used in the ledger / for runner idempotency tracking. */
  readonly id: string;
  /** Human-readable label surfaced in CLI output. */
  readonly label: string;
  /** Table the backfill targets; informs `target.details`. */
  readonly table: string;
  /**
   * Short description of the step (shown by the runner on execute). The
   * planner leaves this as `placeholder(...)` for users to replace.
   */
  readonly description: string;
  /**
   * Producer of the SQL string to execute. Invoked eagerly by
   * `dataTransform(...)`, mirroring the Postgres factory — by the time the
   * user calls this factory in `migration.ts`, the SQL is expected to be
   * ready. Planner-emitted stubs that need to defer until the user fills
   * in the SQL go through `DataTransformCall.renderTypeScript()` instead;
   * this factory is only for the post-fill, runnable form.
   */
  readonly run: () => string;
}
declare function dataTransform(opts: DataTransformOptions): Op;
//#endregion
//#region src/core/migrations/operations/indexes.d.ts
declare function createIndex(tableName: string, indexName: string, columns: readonly string[]): Op;
declare function dropIndex(tableName: string, indexName: string): Op;
//#endregion
//#region src/core/migrations/operations/tables.d.ts
declare function createTable(tableName: string, spec: SqliteTableSpec): Op;
declare function dropTable(tableName: string): Op;
interface RecreateTableArgs {
  readonly tableName: string;
  /** New (post-recreate) shape of the table. Same flat spec as `createTable`. */
  readonly contractTable: SqliteTableSpec;
  /**
   * Names of columns that exist in the live (pre-recreate) schema. Used to
   * compute the `INSERT INTO temp ... SELECT ... FROM old` column list — only
   * shared columns are copied, so dropped columns are left behind and added
   * columns come from defaults.
   */
  readonly schemaColumnNames: readonly string[];
  /**
   * Indexes (declared + FK-backing, deduped by column-set) to recreate after
   * the table has been replaced. The planner pre-merges these.
   */
  readonly indexes: readonly SqliteIndexSpec[];
  /** Human-readable summary of the change, built by the planner from issues. */
  readonly summary: string;
  /**
   * Per-issue postcheck steps appended after the structural postchecks. The
   * planner pre-builds these via `buildRecreatePostchecks` so the call IR
   * carries flat, serializable data only — no `SchemaIssue` references.
   */
  readonly postchecks: readonly {
    readonly description: string;
    readonly sql: string;
  }[];
  readonly operationClass: MigrationOperationClass;
}
declare function recreateTable(args: RecreateTableArgs): Op;
//#endregion
export { type DataTransformOptions, SqliteMigration as Migration, MigrationCLI, addColumn, createIndex, createTable, dataTransform, dropColumn, dropIndex, dropTable, placeholder, recreateTable };
//# sourceMappingURL=migration.d.mts.map