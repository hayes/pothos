import { n as SqliteContract, r as SqliteLoweredStatement, t as SqliteAdapterOptions } from "./types-BFRXGAgd.mjs";
import { Adapter, AdapterProfile, AnyQueryAst, CodecParamsDescriptor, LowererContext } from "@prisma-next/sql-relational-core/ast";

//#region src/core/adapter.d.ts
declare class SqliteAdapterImpl implements Adapter<AnyQueryAst, SqliteContract, SqliteLoweredStatement> {
  readonly familyId: "sql";
  readonly targetId: "sqlite";
  readonly profile: AdapterProfile<'sqlite'>;
  private readonly codecRegistry;
  constructor(options?: SqliteAdapterOptions);
  parameterizedCodecs(): ReadonlyArray<CodecParamsDescriptor>;
  lower(ast: AnyQueryAst, context: LowererContext<SqliteContract>): SqliteLoweredStatement;
}
/**
 * Lower a SQL query AST into a SQLite-flavored `{ sql, params }` payload.
 *
 * Shared between the runtime adapter (`SqliteAdapterImpl.lower`) and the
 * control adapter (`SqliteControlAdapter.lower`) so both produce
 * byte-identical SQL for the same AST and contract.
 */

declare function createSqliteAdapter(options?: SqliteAdapterOptions): Readonly<SqliteAdapterImpl>;
//#endregion
export { createSqliteAdapter as t };
//# sourceMappingURL=adapter-CjuvmCVF.d.mts.map