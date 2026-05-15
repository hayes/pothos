import { AnyQueryAst, LoweredStatement, LowererContext } from "@prisma-next/sql-relational-core/ast";
import { SqlEscapeError, escapeLiteral, quoteIdentifier } from "@prisma-next/target-sqlite/sql-utils";
import { parseSqliteDefault, parseSqliteDefault as parseSqliteDefault$1 } from "@prisma-next/target-sqlite/default-normalizer";
import { normalizeSqliteNativeType, normalizeSqliteNativeType as normalizeSqliteNativeType$1 } from "@prisma-next/target-sqlite/native-type-normalizer";
import { ContractMarkerRecord } from "@prisma-next/contract/types";
import { SqlControlAdapterDescriptor } from "@prisma-next/family-sql/control";
import { SqlControlAdapter } from "@prisma-next/family-sql/control-adapter";
import { ControlDriverInstance } from "@prisma-next/framework-components/control";
import { SqlSchemaIR } from "@prisma-next/sql-schema-ir/types";

//#region src/core/control-adapter.d.ts
declare class SqliteControlAdapter implements SqlControlAdapter<'sqlite'> {
  readonly familyId: "sql";
  readonly targetId: "sqlite";
  readonly normalizeDefault: typeof parseSqliteDefault$1;
  readonly normalizeNativeType: typeof normalizeSqliteNativeType$1;
  /**
   * Lower a SQL query AST into a SQLite-flavored `{ sql, params }` payload.
   *
   * Delegates to the shared `renderLoweredSql` renderer so the control adapter
   * emits byte-identical SQL to `SqliteAdapterImpl.lower()` for the same AST
   * and contract. Used at migration plan/emit time (e.g. by `dataTransform`)
   * without instantiating the runtime adapter.
   */
  lower(ast: AnyQueryAst, context: LowererContext<unknown>): LoweredStatement;
  /**
   * Reads the contract marker from `_prisma_marker`. Probes `sqlite_master`
   * first so a fresh database (no marker table) returns `null` instead of a
   * "no such table" error.
   */
  readMarker(driver: ControlDriverInstance<'sql', 'sqlite'>): Promise<ContractMarkerRecord | null>;
  introspect(driver: ControlDriverInstance<'sql', 'sqlite'>, _contract?: unknown): Promise<SqlSchemaIR>;
}
//#endregion
//#region src/exports/control.d.ts
declare const sqliteAdapterDescriptor: SqlControlAdapterDescriptor<'sqlite'>;
//#endregion
export { SqlEscapeError, SqliteControlAdapter, sqliteAdapterDescriptor as default, escapeLiteral, normalizeSqliteNativeType, parseSqliteDefault, quoteIdentifier };
//# sourceMappingURL=control.d.mts.map