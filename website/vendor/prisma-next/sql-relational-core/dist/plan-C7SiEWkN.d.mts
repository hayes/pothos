import { d as AnyQueryAst } from "./types-B4dL4lc3.mjs";
import { QueryPlan } from "@prisma-next/framework-components/runtime";

//#region src/plan.d.ts

/**
 * SQL query plan produced by lanes before lowering.
 *
 * Lanes build ASTs and metadata but do not perform SQL lowering. The `sql`
 * field is absent — `RuntimeCore` (the runtime base class in
 * `@prisma-next/framework-components/runtime`) drives lowering via the
 * SQL adapter and produces a `SqlExecutionPlan`.
 *
 * Extends the framework-level `QueryPlan<Row>` marker (`meta + _row`) and
 * adds SQL-specific fields (`ast`, `params`). The phantom `_row` property
 * (inherited from `QueryPlan`) is what `ResultType<P>` inspects to recover
 * the row type.
 */
interface SqlQueryPlan<Row = unknown> extends QueryPlan<Row> {
  readonly ast: AnyQueryAst;
  readonly params: readonly unknown[];
}
//#endregion
export { SqlQueryPlan as t };
//# sourceMappingURL=plan-C7SiEWkN.d.mts.map