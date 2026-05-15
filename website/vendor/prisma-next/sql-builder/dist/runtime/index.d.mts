import { _ as ScopeField, f as FieldProxy, g as Scope, h as QueryContext, p as Functions, t as Db, u as AggregateFunctions } from "../db-T7YxA-v6.mjs";
import { AnyExpression } from "@prisma-next/sql-relational-core/ast";
import { Expression } from "@prisma-next/sql-relational-core/expression";
import { SqlStorage } from "@prisma-next/sql-contract/types";
import { SqlOperationEntry } from "@prisma-next/sql-operations";
import { Contract } from "@prisma-next/contract/types";
import { ExecutionContext } from "@prisma-next/sql-relational-core/query-lane-context";

//#region src/runtime/expression-impl.d.ts
/**
 * Runtime wrapper around a relational-core AST expression node.
 * Carries ScopeField metadata (codecId, nullable) so aggregate-like
 * combinators can propagate the input codec onto their result.
 */
declare class ExpressionImpl<T extends ScopeField = ScopeField> implements Expression<T> {
  private readonly ast;
  readonly returnType: T;
  constructor(ast: AnyExpression, returnType: T);
  buildAst(): AnyExpression;
}
//#endregion
//#region src/runtime/field-proxy.d.ts
declare function createFieldProxy<S extends Scope>(scope: S): FieldProxy<S>;
//#endregion
//#region src/runtime/functions.d.ts
declare function createFunctions<QC extends QueryContext>(operations: Readonly<Record<string, SqlOperationEntry>>): Functions<QC>;
declare function createAggregateFunctions<QC extends QueryContext>(operations: Readonly<Record<string, SqlOperationEntry>>): AggregateFunctions<QC>;
//#endregion
//#region src/runtime/sql.d.ts
interface SqlOptions<C extends Contract<SqlStorage>> {
  readonly context: ExecutionContext<C>;
}
declare function sql<C extends Contract<SqlStorage>>(options: SqlOptions<C>): Db<C>;
//#endregion
export { type Db, ExpressionImpl, type SqlOptions, createAggregateFunctions, createFieldProxy, createFunctions, sql };
//# sourceMappingURL=index.d.mts.map