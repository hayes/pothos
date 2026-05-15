import { t as SqlitePlanTargetDetails } from "./planner-target-details-DTIFFx4L.mjs";
import { SqlMigrationPlanOperation } from "@prisma-next/family-sql/control";
import { ReferentialAction } from "@prisma-next/sql-contract/types";

//#region src/core/migrations/operations/shared.d.ts
type Op = SqlMigrationPlanOperation<SqlitePlanTargetDetails>;
/**
 * Flat, fully-resolved column shape consumed by `createTable`, `addColumn`,
 * and `recreateTable`. Codec / `typeRef` / default expansion happens at the
 * call-construction site (in the issue-planner / strategies) so the
 * operation factories deal only in pre-rendered SQL fragments — mirrors the
 * Postgres `ColumnSpec` pattern.
 *
 * - `typeSql` is the column's DDL type token (e.g. `"INTEGER"`, `"TEXT"`).
 * - `defaultSql` is the full `DEFAULT …` clause (or empty when there is no
 *   default and when the column is rendered as `INTEGER PRIMARY KEY
 *   AUTOINCREMENT`, since SQLite forbids a default on an autoincrement PK).
 * - `inlineAutoincrementPrimaryKey` directs the renderer to emit
 *   `INTEGER PRIMARY KEY AUTOINCREMENT` inline and to skip the table-level
 *   primary-key constraint for this column. SQLite-specific: the column
 *   becomes an alias for `rowid` only when this exact form is used.
 */
interface SqliteColumnSpec {
  readonly name: string;
  readonly typeSql: string;
  readonly defaultSql: string;
  readonly nullable: boolean;
  readonly inlineAutoincrementPrimaryKey?: boolean;
}
interface SqlitePrimaryKeySpec {
  readonly columns: readonly string[];
}
interface SqliteUniqueSpec {
  readonly columns: readonly string[];
  readonly name?: string;
}
interface SqliteForeignKeySpec {
  readonly columns: readonly string[];
  readonly references: {
    readonly table: string;
    readonly columns: readonly string[];
  };
  readonly name?: string;
  readonly onDelete?: ReferentialAction;
  readonly onUpdate?: ReferentialAction;
  readonly constraint: boolean;
}
/**
 * Flat shape of a contract table for DDL emission. Used by both
 * `createTable` (additive) and `recreateTable` (widening/destructive).
 */
interface SqliteTableSpec {
  readonly columns: readonly SqliteColumnSpec[];
  readonly primaryKey?: SqlitePrimaryKeySpec;
  readonly uniques?: readonly SqliteUniqueSpec[];
  readonly foreignKeys?: readonly SqliteForeignKeySpec[];
}
/**
 * Index recreation spec for `recreateTable`. Both declared indexes and
 * FK-backing indexes flatten to the same shape; the planner dedupes by
 * column-set before constructing the call.
 */
interface SqliteIndexSpec {
  readonly name: string;
  readonly columns: readonly string[];
}
//#endregion
export { SqliteTableSpec as i, SqliteColumnSpec as n, SqliteIndexSpec as r, Op as t };
//# sourceMappingURL=shared-BNtoZqdo.d.mts.map