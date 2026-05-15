import { d as AnyQueryAst } from "./types-B4dL4lc3.mjs";
import { ExecutionPlan } from "@prisma-next/framework-components/runtime";

//#region src/sql-execution-plan.d.ts

/**
 * SQL-domain execution plan: a query lowered to the wire-level shape that a
 * SQL driver can run.
 *
 * The plan carries:
 * - `sql` — the rendered SQL text
 * - `params` — the bound parameter list
 * - `ast` — optional pre-lowering AST, retained for telemetry / debugging
 * - `meta` — family-agnostic plan metadata (target, lane, hashes, ...)
 * - `_row` — phantom row type, propagated from the originating `SqlQueryPlan`
 *
 * Extends the framework-level `ExecutionPlan<Row>` marker so generic SPIs
 * (`RuntimeExecutor<SqlExecutionPlan>`, `RuntimeMiddleware<SqlExecutionPlan>`)
 * can be parameterized over it.
 *
 * Co-located with `SqlQueryPlan` (its pre-lowering counterpart) in the lanes
 * layer because lane-level utilities (`RawTemplateFactory`, `RawFactory`,
 * `SqlPlan`) compose against the executable shape and the lanes layer cannot
 * depend on the runtime layer.
 */
interface SqlExecutionPlan<Row = unknown> extends ExecutionPlan<Row> {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly ast?: AnyQueryAst;
}
//#endregion
export { SqlExecutionPlan as t };
//# sourceMappingURL=sql-execution-plan-Dgx7BGin.d.mts.map