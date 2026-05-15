import { S as OperationExpr, T as ParamRef } from "../types-DUL-3vy6.mjs";

//#region src/expression.ts
/**
* Resolve a raw value or an Expression into an AST expression node.
*
* When `value` is an Expression (duck-typed by its `buildAst` method), the AST
* it wraps is returned. Otherwise the value is embedded as a ParamRef tagged
* with `codecId` (if given). Pass `codecId` to encode the literal with a
* specific codec — most operations do.
*/
function toExpr(value, codecId) {
	if (isExpressionLike(value)) return value.buildAst();
	return ParamRef.of(value, codecId ? { codecId } : void 0);
}
function isExpressionLike(value) {
	return typeof value === "object" && value !== null && "buildAst" in value && typeof value.buildAst === "function";
}
/**
* Construct an OperationExpr AST node and wrap it as a typed Expression.
* Operation implementations use this to turn their user-facing arguments into
* the AST node the compilation pipeline eventually lowers to SQL.
*/
function buildOperation(spec) {
	const [self, ...rest] = spec.args;
	const op = new OperationExpr({
		method: spec.method,
		self,
		args: rest.length > 0 ? rest : void 0,
		returns: spec.returns,
		lowering: spec.lowering
	});
	return {
		returnType: spec.returns,
		buildAst: () => op
	};
}

//#endregion
export { buildOperation, toExpr };
//# sourceMappingURL=expression.mjs.map