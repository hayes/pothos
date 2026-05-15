import { o as AnyExpression } from "../types-B4dL4lc3.mjs";
import { ParamSpec } from "@prisma-next/operations";
import { SqlLoweringSpec } from "@prisma-next/sql-operations";
import { QueryOperationReturn } from "@prisma-next/sql-contract/types";

//#region src/expression.d.ts
type ScopeField = {
  codecId: string;
  nullable: boolean;
};
/**
 * A typed SQL expression. Identity is carried by the `returnType` descriptor
 * (inherited from `QueryOperationReturn` and narrowed to `T`) — distinct `T`
 * makes distinct Expression types structurally. `buildAst()` materialises the
 * underlying AST node.
 */
type Expression<T$1 extends ScopeField> = QueryOperationReturn & {
  readonly returnType: T$1;
  buildAst(): AnyExpression;
};
type CodecIdsWithTrait<CT extends Record<string, {
  readonly input: unknown;
}>, RequiredTraits extends readonly string[]> = { [K in keyof CT & string]: CT[K] extends {
  readonly traits: infer T;
} ? [RequiredTraits[number]] extends [T] ? K : never : never }[keyof CT & string];
type NullSuffix<N> = N extends true ? null : never;
/**
 * An expression or literal value targeting a specific codec.
 *
 * Accepts any of:
 *   - An `Expression` whose codec matches exactly
 *   - A raw JS value of the codec's `input` type
 *   - `null` when `Nullable` is true
 */
type CodecExpression<CodecId extends string, Nullable extends boolean, CT extends Record<string, {
  readonly input: unknown;
}>> = Expression<{
  codecId: CodecId;
  nullable: Nullable;
}> | (CodecId extends keyof CT ? CT[CodecId]['input'] : never) | NullSuffix<Nullable>;
/**
 * An expression or literal value targeting any codec whose trait set contains
 * all the required traits.
 *
 * Resolves the trait set to the union of matching codec identities via
 * `CodecIdsWithTrait`, then reuses `CodecExpression` for the codec-id form.
 */
type TraitExpression<Traits extends readonly string[], Nullable extends boolean, CT extends Record<string, {
  readonly input: unknown;
}>> = CodecExpression<CodecIdsWithTrait<CT, Traits>, Nullable, CT>;
/**
 * Resolve a raw value or an Expression into an AST expression node.
 *
 * When `value` is an Expression (duck-typed by its `buildAst` method), the AST
 * it wraps is returned. Otherwise the value is embedded as a ParamRef tagged
 * with `codecId` (if given). Pass `codecId` to encode the literal with a
 * specific codec — most operations do.
 */
declare function toExpr(value: unknown, codecId?: string): AnyExpression;
interface BuildOperationSpec<R extends ScopeField> {
  readonly method: string;
  /**
   * The operation's arguments. The first element is the self argument (the
   * value the operation is being applied to); the rest are the remaining
   * user-supplied arguments.
   */
  readonly args: readonly [AnyExpression, ...AnyExpression[]];
  readonly returns: R & ParamSpec;
  readonly lowering: SqlLoweringSpec;
}
/**
 * Construct an OperationExpr AST node and wrap it as a typed Expression.
 * Operation implementations use this to turn their user-facing arguments into
 * the AST node the compilation pipeline eventually lowers to SQL.
 */
declare function buildOperation<R extends ScopeField>(spec: BuildOperationSpec<R>): Expression<R>;
//#endregion
export { BuildOperationSpec, CodecExpression, Expression, ScopeField, TraitExpression, buildOperation, toExpr };
//# sourceMappingURL=expression.d.mts.map