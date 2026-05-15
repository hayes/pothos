import { OperationDescriptor, OperationRegistry } from "@prisma-next/operations";
import { QueryOperationTypeEntry } from "@prisma-next/sql-contract/types";

//#region src/index.d.ts
interface SqlLoweringSpec {
  readonly targetFamily: 'sql';
  readonly strategy: 'infix' | 'function';
  readonly template: string;
}
/**
 * Runtime shape of a SQL operation entry — tightened beyond the framework's
 * target-agnostic `OperationEntry` so `impl` returns a codec-exact
 * `QueryOperationReturn` instead of `unknown`. Consumers (ORM column helper,
 * sql-builder `fns` dispatch) can read `result.returnType.codecId` without a
 * cast.
 */
type SqlOperationEntry = QueryOperationTypeEntry;
type SqlOperationDescriptor = OperationDescriptor<SqlOperationEntry>;
type SqlOperationRegistry = OperationRegistry<SqlOperationEntry>;
declare function createSqlOperationRegistry(): SqlOperationRegistry;
//#endregion
export { SqlLoweringSpec, SqlOperationDescriptor, SqlOperationEntry, SqlOperationRegistry, createSqlOperationRegistry };
//# sourceMappingURL=index.d.mts.map