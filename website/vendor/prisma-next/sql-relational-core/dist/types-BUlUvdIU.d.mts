import { t as SqlExecutionPlan } from "./sql-execution-plan-Dgx7BGin.mjs";
import { t as SqlQueryPlan } from "./plan-C7SiEWkN.mjs";
import { RuntimeExecutor } from "@prisma-next/framework-components/runtime";

//#region src/runtime-scope.d.ts

/**
 * The plan shape accepted by the SQL ORM client and SQL runtime: either a
 * pre-lowering `SqlQueryPlan` (AST + meta) or a post-lowering
 * `SqlExecutionPlan` (sql + params + meta).
 */
type SqlOrmPlan = SqlExecutionPlan | SqlQueryPlan;
/**
 * The minimal SQL-runtime surface that the ORM client and SQL runtime both
 * depend on: the `execute` method of `RuntimeExecutor<SqlOrmPlan>`.
 *
 * Owned by `sql-relational-core` (lanes layer) so both
 * `@prisma-next/sql-runtime` and `@prisma-next/sql-orm-client` consume the
 * same source of truth without a layering inversion.
 */
type RuntimeScope = Pick<RuntimeExecutor<SqlOrmPlan>, 'execute'>;
//#endregion
export { SqlOrmPlan as n, RuntimeScope as t };
//# sourceMappingURL=types-BUlUvdIU.d.mts.map