import { AggregateExpr, AndExpr, BinaryExpr, ColumnRef, DeleteAst, DerivedTableSource, ExistsExpr, IdentifierRef, InsertAst, JoinAst, ListExpression, LiteralExpr, NullCheckExpr, OrExpr, OrderByItem, ParamRef, ProjectionItem, SelectAst, SubqueryExpr, TableSource, UpdateAst, collectOrderedParamRefs } from "@prisma-next/sql-relational-core/ast";
import { toExpr } from "@prisma-next/sql-relational-core/expression";

//#region src/runtime/expression-impl.ts
/**
* Runtime wrapper around a relational-core AST expression node.
* Carries ScopeField metadata (codecId, nullable) so aggregate-like
* combinators can propagate the input codec onto their result.
*/
var ExpressionImpl = class {
	ast;
	returnType;
	constructor(ast, returnType) {
		this.ast = ast;
		this.returnType = returnType;
	}
	buildAst() {
		return this.ast;
	}
};

//#endregion
//#region src/runtime/field-proxy.ts
function createFieldProxy(scope) {
	return new Proxy({}, { get(_target, prop) {
		if (Object.hasOwn(scope.topLevel, prop)) {
			const topField = scope.topLevel[prop];
			if (topField) return new ExpressionImpl(IdentifierRef.of(prop), topField);
		}
		if (Object.hasOwn(scope.namespaces, prop)) {
			const nsFields = scope.namespaces[prop];
			if (nsFields) return createNamespaceProxy(prop, nsFields);
		}
	} });
}
function createNamespaceProxy(namespaceName, fields) {
	return new Proxy({}, { get(_target, prop) {
		if (Object.hasOwn(fields, prop)) {
			const field = fields[prop];
			if (field) return new ExpressionImpl(ColumnRef.of(namespaceName, prop), field);
		}
	} });
}

//#endregion
//#region src/runtime/functions.ts
const BOOL_FIELD = {
	codecId: "pg/bool@1",
	nullable: false
};
const resolve = toExpr;
/**
* Resolves an Expression via `buildAst()`, or wraps a raw value as a
* `LiteralExpr` — an SQL literal inlined into the query text, not a bound
* parameter.
*
* Used for `and` / `or` operands. The usual operand is an `Expression<bool>`
* (e.g. the result of `fns.eq`), which this function passes through by calling
* `buildAst()`. The only time the raw-value branch fires is when the caller
* writes `fns.and(true, x)` or similar — inlining `TRUE`/`FALSE` literals
* lets the SQL planner statically simplify `TRUE AND x` to `x`, which it
* cannot do for an opaque `ParamRef`.
*/
function toLiteralExpr(value) {
	if (typeof value === "object" && value !== null && "buildAst" in value && typeof value.buildAst === "function") return value.buildAst();
	return new LiteralExpr(value);
}
function boolExpr(astNode) {
	return new ExpressionImpl(astNode, BOOL_FIELD);
}
function eq(a, b) {
	if (b === null) return boolExpr(NullCheckExpr.isNull(resolve(a)));
	if (a === null) return boolExpr(NullCheckExpr.isNull(resolve(b)));
	return boolExpr(new BinaryExpr("eq", resolve(a), resolve(b)));
}
function ne(a, b) {
	if (b === null) return boolExpr(NullCheckExpr.isNotNull(resolve(a)));
	if (a === null) return boolExpr(NullCheckExpr.isNotNull(resolve(b)));
	return boolExpr(new BinaryExpr("neq", resolve(a), resolve(b)));
}
function comparison(a, b, op) {
	return boolExpr(new BinaryExpr(op, resolve(a), resolve(b)));
}
function inOrNotIn(expr, valuesOrSubquery, op) {
	const left = expr.buildAst();
	const binaryFn = op === "in" ? BinaryExpr.in : BinaryExpr.notIn;
	if (Array.isArray(valuesOrSubquery)) {
		const refs = valuesOrSubquery.map((v) => resolve(v));
		return boolExpr(binaryFn(left, ListExpression.of(refs)));
	}
	return boolExpr(binaryFn(left, SubqueryExpr.of(valuesOrSubquery.buildAst())));
}
function numericAgg(fn, expr) {
	return new ExpressionImpl(AggregateExpr[fn](expr.buildAst()), {
		codecId: expr.returnType.codecId,
		nullable: true
	});
}
function createBuiltinFunctions() {
	return {
		eq: (a, b) => eq(a, b),
		ne: (a, b) => ne(a, b),
		gt: (a, b) => comparison(a, b, "gt"),
		gte: (a, b) => comparison(a, b, "gte"),
		lt: (a, b) => comparison(a, b, "lt"),
		lte: (a, b) => comparison(a, b, "lte"),
		and: (...exprs) => boolExpr(AndExpr.of(exprs.map(toLiteralExpr))),
		or: (...exprs) => boolExpr(OrExpr.of(exprs.map(toLiteralExpr))),
		exists: (subquery) => boolExpr(ExistsExpr.exists(subquery.buildAst())),
		notExists: (subquery) => boolExpr(ExistsExpr.notExists(subquery.buildAst())),
		in: (expr, valuesOrSubquery) => inOrNotIn(expr, valuesOrSubquery, "in"),
		notIn: (expr, valuesOrSubquery) => inOrNotIn(expr, valuesOrSubquery, "notIn")
	};
}
function createAggregateOnlyFunctions() {
	return {
		count: (expr) => {
			const astExpr = expr ? expr.buildAst() : void 0;
			return new ExpressionImpl(AggregateExpr.count(astExpr), {
				codecId: "pg/int8@1",
				nullable: false
			});
		},
		sum: (expr) => numericAgg("sum", expr),
		avg: (expr) => numericAgg("avg", expr),
		min: (expr) => numericAgg("min", expr),
		max: (expr) => numericAgg("max", expr)
	};
}
function createFunctions(operations) {
	const builtins = createBuiltinFunctions();
	return new Proxy({}, { get(_target, prop) {
		const builtin = builtins[prop];
		if (builtin) return builtin;
		const op = operations[prop];
		if (op) return op.impl;
	} });
}
function createAggregateFunctions(operations) {
	const baseFns = createFunctions(operations);
	const aggregates = createAggregateOnlyFunctions();
	return new Proxy({}, { get(_target, prop) {
		const agg = aggregates[prop];
		if (agg) return agg;
		return baseFns[prop];
	} });
}

//#endregion
//#region src/runtime/builder-base.ts
var BuilderBase = class {
	ctx;
	constructor(ctx) {
		this.ctx = ctx;
	}
	_gate(required, methodName, method) {
		return ((...args) => {
			assertCapability(this.ctx, required, methodName);
			return method(...args);
		});
	}
};
function emptyState(from, scope) {
	return {
		from,
		joins: [],
		projections: [],
		where: [],
		orderBy: [],
		groupBy: [],
		having: void 0,
		limit: void 0,
		offset: void 0,
		distinct: void 0,
		distinctOn: void 0,
		scope,
		rowFields: {}
	};
}
function cloneState(state, overrides) {
	return {
		...state,
		...overrides
	};
}
function combineWhereExprs(exprs) {
	if (exprs.length === 0) return void 0;
	if (exprs.length === 1) return exprs[0];
	return AndExpr.of(exprs);
}
function buildSelectAst(state) {
	const where = combineWhereExprs(state.where);
	return new SelectAst({
		from: state.from,
		joins: state.joins.length > 0 ? state.joins : void 0,
		projection: state.projections,
		where,
		orderBy: state.orderBy.length > 0 ? state.orderBy : void 0,
		distinct: state.distinct,
		distinctOn: state.distinctOn && state.distinctOn.length > 0 ? state.distinctOn : void 0,
		groupBy: state.groupBy.length > 0 ? state.groupBy : void 0,
		having: state.having,
		limit: state.limit,
		offset: state.offset,
		selectAllIntent: void 0
	});
}
function buildQueryPlan(ast, ctx) {
	const paramValues = collectOrderedParamRefs(ast).map((r) => r.value);
	const meta = Object.freeze({
		target: ctx.target,
		storageHash: ctx.storageHash,
		lane: "dsl"
	});
	return Object.freeze({
		ast,
		params: paramValues,
		meta
	});
}
function buildPlan(state, ctx) {
	return buildQueryPlan(buildSelectAst(state), ctx);
}
function tableToScope(name, table) {
	const fields = {};
	for (const [colName, col] of Object.entries(table.columns)) fields[colName] = {
		codecId: col.codecId,
		nullable: col.nullable
	};
	return {
		topLevel: { ...fields },
		namespaces: { [name]: fields }
	};
}
function mergeScopes(a, b) {
	const topLevel = {};
	for (const [k, v] of Object.entries(a.topLevel)) if (!(k in b.topLevel)) topLevel[k] = v;
	for (const [k, v] of Object.entries(b.topLevel)) if (!(k in a.topLevel)) topLevel[k] = v;
	return {
		topLevel,
		namespaces: {
			...a.namespaces,
			...b.namespaces
		}
	};
}
function nullableScope(scope) {
	const mkNullable = (tbl) => {
		const result = {};
		for (const [k, v] of Object.entries(tbl)) result[k] = {
			codecId: v.codecId,
			nullable: true
		};
		return result;
	};
	const namespaces = {};
	for (const [k, v] of Object.entries(scope.namespaces)) namespaces[k] = mkNullable(v);
	return {
		topLevel: mkNullable(scope.topLevel),
		namespaces
	};
}
function orderByScopeOf(scope, rowFields) {
	return {
		topLevel: {
			...scope.topLevel,
			...rowFields
		},
		namespaces: scope.namespaces
	};
}
function assertCapability(ctx, required, methodName) {
	for (const [ns, keys] of Object.entries(required)) for (const key of Object.keys(keys)) if (!ctx.capabilities[ns]?.[key]) throw new Error(`${methodName}() requires capability ${ns}.${key}`);
}
function resolveSelectArgs(args, scope, ctx) {
	const projections = [];
	const newRowFields = {};
	if (args.length === 0) return {
		projections,
		newRowFields
	};
	if (typeof args[0] === "string" && (args.length === 1 || typeof args[1] !== "function")) {
		for (const colName of args) {
			const field = scope.topLevel[colName];
			if (!field) throw new Error(`Column "${colName}" not found in scope`);
			projections.push(ProjectionItem.of(colName, IdentifierRef.of(colName), field.codecId));
			newRowFields[colName] = field;
		}
		return {
			projections,
			newRowFields
		};
	}
	if (typeof args[0] === "string" && typeof args[1] === "function") {
		const alias = args[0];
		const exprFn = args[1];
		const fns = createAggregateFunctions(ctx.queryOperationTypes);
		const result = exprFn(createFieldProxy(scope), fns);
		const field = result.returnType;
		projections.push(ProjectionItem.of(alias, result.buildAst(), field.codecId));
		newRowFields[alias] = field;
		return {
			projections,
			newRowFields
		};
	}
	if (typeof args[0] === "function") {
		const callbackFn = args[0];
		const fns = createAggregateFunctions(ctx.queryOperationTypes);
		const record = callbackFn(createFieldProxy(scope), fns);
		for (const [key, expr] of Object.entries(record)) {
			const field = expr.returnType;
			projections.push(ProjectionItem.of(key, expr.buildAst(), field.codecId));
			newRowFields[key] = field;
		}
		return {
			projections,
			newRowFields
		};
	}
	throw new Error("Invalid .select() arguments");
}
function resolveOrderBy(arg, options, scope, rowFields, ctx, useAggregateFns) {
	const dir = options?.direction ?? "asc";
	if (typeof arg === "string") {
		if (!(arg in orderByScopeOf(scope, rowFields).topLevel)) throw new Error(`Column "${arg}" not found in scope for orderBy`);
		const expr = IdentifierRef.of(arg);
		return dir === "asc" ? OrderByItem.asc(expr) : OrderByItem.desc(expr);
	}
	if (typeof arg === "function") {
		const combined = orderByScopeOf(scope, rowFields);
		const fns = useAggregateFns ? createAggregateFunctions(ctx.queryOperationTypes) : createFunctions(ctx.queryOperationTypes);
		const result = arg(createFieldProxy(combined), fns);
		return dir === "asc" ? OrderByItem.asc(result.buildAst()) : OrderByItem.desc(result.buildAst());
	}
	throw new Error("Invalid orderBy argument");
}
function resolveGroupBy(args, scope, rowFields, ctx) {
	if (typeof args[0] === "string") {
		const combined = orderByScopeOf(scope, rowFields);
		return args.map((colName) => {
			if (!(colName in combined.topLevel)) throw new Error(`Column "${colName}" not found in scope for groupBy`);
			return IdentifierRef.of(colName);
		});
	}
	if (typeof args[0] === "function") {
		const combined = orderByScopeOf(scope, rowFields);
		const fns = createFunctions(ctx.queryOperationTypes);
		return [args[0](createFieldProxy(combined), fns).buildAst()];
	}
	throw new Error("Invalid groupBy arguments");
}
function resolveDistinctOn(args, scope, rowFields, ctx) {
	if (args.length === 1 && typeof args[0] === "function") {
		const combined$1 = orderByScopeOf(scope, rowFields);
		const fns = createFunctions(ctx.queryOperationTypes);
		return [args[0](createFieldProxy(combined$1), fns).buildAst()];
	}
	const combined = orderByScopeOf(scope, rowFields);
	return args.map((colName) => {
		if (!(colName in combined.topLevel)) throw new Error(`Column "${colName}" not found in scope for distinctOn`);
		return IdentifierRef.of(colName);
	});
}

//#endregion
//#region src/runtime/query-impl.ts
var QueryBase = class extends BuilderBase {
	state;
	constructor(state, ctx) {
		super(ctx);
		this.state = state;
	}
	distinctOn = this._gate({ postgres: { distinctOn: true } }, "distinctOn", (...args) => {
		const exprs = resolveDistinctOn(args, this.state.scope, this.state.rowFields, this.ctx);
		return this.clone(cloneState(this.state, { distinctOn: [...this.state.distinctOn ?? [], ...exprs] }));
	});
	limit(count) {
		return this.clone(cloneState(this.state, { limit: count }));
	}
	offset(count) {
		return this.clone(cloneState(this.state, { offset: count }));
	}
	distinct() {
		return this.clone(cloneState(this.state, { distinct: true }));
	}
	groupBy(...args) {
		const exprs = resolveGroupBy(args, this.state.scope, this.state.rowFields, this.ctx);
		return new GroupedQueryImpl(cloneState(this.state, { groupBy: [...this.state.groupBy, ...exprs] }), this.ctx);
	}
	as(alias) {
		const ast = buildSelectAst(this.state);
		const derivedSource = DerivedTableSource.as(alias, ast);
		const scope = {
			topLevel: this.state.rowFields,
			namespaces: { [alias]: this.state.rowFields }
		};
		return {
			getJoinOuterScope: () => scope,
			buildAst: () => derivedSource
		};
	}
	getRowFields() {
		return this.state.rowFields;
	}
	buildAst() {
		return buildSelectAst(this.state);
	}
	build() {
		return buildPlan(this.state, this.ctx);
	}
};
var SelectQueryImpl = class SelectQueryImpl extends QueryBase {
	clone(state) {
		return new SelectQueryImpl(state, this.ctx);
	}
	select(...args) {
		const { projections, newRowFields } = resolveSelectArgs(args, this.state.scope, this.ctx);
		return new SelectQueryImpl(cloneState(this.state, {
			projections: [...this.state.projections, ...projections],
			rowFields: {
				...this.state.rowFields,
				...newRowFields
			}
		}), this.ctx);
	}
	where(expr) {
		const result = expr(createFieldProxy(this.state.scope), createFunctions(this.ctx.queryOperationTypes));
		return new SelectQueryImpl(cloneState(this.state, { where: [...this.state.where, result.buildAst()] }), this.ctx);
	}
	orderBy(arg, options) {
		const item = resolveOrderBy(arg, options, this.state.scope, this.state.rowFields, this.ctx, false);
		return this.clone(cloneState(this.state, { orderBy: [...this.state.orderBy, item] }));
	}
};
var GroupedQueryImpl = class GroupedQueryImpl extends QueryBase {
	clone(state) {
		return new GroupedQueryImpl(state, this.ctx);
	}
	having(expr) {
		const combined = orderByScopeOf(this.state.scope, this.state.rowFields);
		const fns = createAggregateFunctions(this.ctx.queryOperationTypes);
		const result = expr(createFieldProxy(combined), fns);
		return new GroupedQueryImpl(cloneState(this.state, { having: result.buildAst() }), this.ctx);
	}
	orderBy(arg, options) {
		const item = resolveOrderBy(arg, options, this.state.scope, this.state.rowFields, this.ctx, true);
		return this.clone(cloneState(this.state, { orderBy: [...this.state.orderBy, item] }));
	}
};

//#endregion
//#region src/runtime/joined-tables-impl.ts
var JoinedTablesImpl = class JoinedTablesImpl extends BuilderBase {
	#state;
	constructor(state, ctx) {
		super(ctx);
		this.#state = state;
	}
	lateralJoin = this._gate({ sql: { lateral: true } }, "lateralJoin", (alias, builder) => {
		const { derivedSource, lateralScope } = this.#buildLateral(alias, builder);
		const resultScope = mergeScopes(this.#state.scope, lateralScope);
		return this.#addLateralJoin("inner", resultScope, derivedSource);
	});
	outerLateralJoin = this._gate({ sql: { lateral: true } }, "outerLateralJoin", (alias, builder) => {
		const { derivedSource, lateralScope } = this.#buildLateral(alias, builder);
		const resultScope = mergeScopes(this.#state.scope, nullableScope(lateralScope));
		return this.#addLateralJoin("left", resultScope, derivedSource);
	});
	select(...args) {
		const { projections, newRowFields } = resolveSelectArgs(args, this.#state.scope, this.ctx);
		return new SelectQueryImpl(cloneState(this.#state, {
			projections: [...this.#state.projections, ...projections],
			rowFields: {
				...this.#state.rowFields,
				...newRowFields
			}
		}), this.ctx);
	}
	innerJoin(other, on) {
		const targetScope = mergeScopes(this.#state.scope, other.getJoinOuterScope());
		return this.#addJoin(other, "inner", targetScope, on);
	}
	outerLeftJoin(other, on) {
		const targetScope = mergeScopes(this.#state.scope, nullableScope(other.getJoinOuterScope()));
		return this.#addJoin(other, "left", targetScope, on);
	}
	outerRightJoin(other, on) {
		const targetScope = mergeScopes(nullableScope(this.#state.scope), other.getJoinOuterScope());
		return this.#addJoin(other, "right", targetScope, on);
	}
	outerFullJoin(other, on) {
		const targetScope = mergeScopes(nullableScope(this.#state.scope), nullableScope(other.getJoinOuterScope()));
		return this.#addJoin(other, "full", targetScope, on);
	}
	#addJoin(other, joinType, resultScope, onExpr) {
		const onResult = onExpr(createFieldProxy(mergeScopes(this.#state.scope, other.getJoinOuterScope())), createFunctions(this.ctx.queryOperationTypes));
		const joinAst = new JoinAst(joinType, other.buildAst(), onResult.buildAst());
		return new JoinedTablesImpl(cloneState(this.#state, {
			joins: [...this.#state.joins, joinAst],
			scope: resultScope
		}), this.ctx);
	}
	#buildLateral(alias, builderFn) {
		const subquery = builderFn({ from: (other) => {
			const otherScope = other.getJoinOuterScope();
			const parentMerged = mergeScopes(this.#state.scope, otherScope);
			return new SelectQueryImpl(emptyState(other.buildAst(), parentMerged), this.ctx);
		} });
		const subqueryAst = subquery.buildAst();
		const derivedSource = DerivedTableSource.as(alias, subqueryAst);
		const subqueryRowFields = subquery.getRowFields();
		return {
			derivedSource,
			lateralScope: {
				topLevel: subqueryRowFields,
				namespaces: { [alias]: subqueryRowFields }
			}
		};
	}
	#addLateralJoin(joinType, resultScope, derivedSource) {
		const joinAst = new JoinAst(joinType, derivedSource, AndExpr.of([]), true);
		return new JoinedTablesImpl(cloneState(this.#state, {
			joins: [...this.#state.joins, joinAst],
			scope: resultScope
		}), this.ctx);
	}
};

//#endregion
//#region src/runtime/mutation-impl.ts
function buildParamValues(values, table, tableName, op, ctx) {
	const params = {};
	for (const [col, value] of Object.entries(values)) {
		const column = table.columns[col];
		params[col] = ParamRef.of(value, column ? { codecId: column.codecId } : void 0);
	}
	for (const def of ctx.applyMutationDefaults({
		op,
		table: tableName,
		values
	})) {
		const column = table.columns[def.column];
		params[def.column] = ParamRef.of(def.value, column ? { codecId: column.codecId } : void 0);
	}
	return params;
}
function buildReturningProjections(tableName, columns, rowFields) {
	return columns.map((col) => ProjectionItem.of(col, ColumnRef.of(tableName, col), rowFields[col]?.codecId));
}
function evaluateWhere(whereCallback, scope, queryOperationTypes) {
	return whereCallback(createFieldProxy(scope), createFunctions(queryOperationTypes)).buildAst();
}
var InsertQueryImpl = class InsertQueryImpl extends BuilderBase {
	#tableName;
	#table;
	#scope;
	#values;
	#returningColumns;
	#rowFields;
	constructor(tableName, table, scope, values, ctx, returningColumns = [], rowFields = {}) {
		super(ctx);
		this.#tableName = tableName;
		this.#table = table;
		this.#scope = scope;
		this.#values = values;
		this.#returningColumns = returningColumns;
		this.#rowFields = rowFields;
	}
	returning = this._gate({ sql: { returning: true } }, "returning", (...columns) => {
		const newRowFields = {};
		for (const col of columns) {
			const field = this.#scope.topLevel[col];
			if (!field) throw new Error(`Column "${col}" not found in scope`);
			newRowFields[col] = field;
		}
		return new InsertQueryImpl(this.#tableName, this.#table, this.#scope, this.#values, this.ctx, columns, newRowFields);
	});
	build() {
		const paramValues = buildParamValues(this.#values, this.#table, this.#tableName, "create", this.ctx);
		let ast = InsertAst.into(TableSource.named(this.#tableName)).withValues(paramValues);
		if (this.#returningColumns.length > 0) ast = ast.withReturning(buildReturningProjections(this.#tableName, this.#returningColumns, this.#rowFields));
		return buildQueryPlan(ast, this.ctx);
	}
};
var UpdateQueryImpl = class UpdateQueryImpl extends BuilderBase {
	#tableName;
	#table;
	#scope;
	#setValues;
	#whereCallbacks;
	#returningColumns;
	#rowFields;
	constructor(tableName, table, scope, setValues, ctx, whereCallbacks = [], returningColumns = [], rowFields = {}) {
		super(ctx);
		this.#tableName = tableName;
		this.#table = table;
		this.#scope = scope;
		this.#setValues = setValues;
		this.#whereCallbacks = whereCallbacks;
		this.#returningColumns = returningColumns;
		this.#rowFields = rowFields;
	}
	where(expr) {
		return new UpdateQueryImpl(this.#tableName, this.#table, this.#scope, this.#setValues, this.ctx, [...this.#whereCallbacks, expr], this.#returningColumns, this.#rowFields);
	}
	returning = this._gate({ sql: { returning: true } }, "returning", (...columns) => {
		const newRowFields = {};
		for (const col of columns) {
			const field = this.#scope.topLevel[col];
			if (!field) throw new Error(`Column "${col}" not found in scope`);
			newRowFields[col] = field;
		}
		return new UpdateQueryImpl(this.#tableName, this.#table, this.#scope, this.#setValues, this.ctx, this.#whereCallbacks, columns, newRowFields);
	});
	build() {
		const setParams = buildParamValues(this.#setValues, this.#table, this.#tableName, "update", this.ctx);
		const whereExpr = combineWhereExprs(this.#whereCallbacks.map((cb) => evaluateWhere(cb, this.#scope, this.ctx.queryOperationTypes)));
		let ast = UpdateAst.table(TableSource.named(this.#tableName)).withSet(setParams).withWhere(whereExpr);
		if (this.#returningColumns.length > 0) ast = ast.withReturning(buildReturningProjections(this.#tableName, this.#returningColumns, this.#rowFields));
		return buildQueryPlan(ast, this.ctx);
	}
};
var DeleteQueryImpl = class DeleteQueryImpl extends BuilderBase {
	#tableName;
	#scope;
	#whereCallbacks;
	#returningColumns;
	#rowFields;
	constructor(tableName, scope, ctx, whereCallbacks = [], returningColumns = [], rowFields = {}) {
		super(ctx);
		this.#tableName = tableName;
		this.#scope = scope;
		this.#whereCallbacks = whereCallbacks;
		this.#returningColumns = returningColumns;
		this.#rowFields = rowFields;
	}
	where(expr) {
		return new DeleteQueryImpl(this.#tableName, this.#scope, this.ctx, [...this.#whereCallbacks, expr], this.#returningColumns, this.#rowFields);
	}
	returning = this._gate({ sql: { returning: true } }, "returning", (...columns) => {
		const newRowFields = {};
		for (const col of columns) {
			const field = this.#scope.topLevel[col];
			if (!field) throw new Error(`Column "${col}" not found in scope`);
			newRowFields[col] = field;
		}
		return new DeleteQueryImpl(this.#tableName, this.#scope, this.ctx, this.#whereCallbacks, columns, newRowFields);
	});
	build() {
		const whereExpr = combineWhereExprs(this.#whereCallbacks.map((cb) => evaluateWhere(cb, this.#scope, this.ctx.queryOperationTypes)));
		let ast = DeleteAst.from(TableSource.named(this.#tableName)).withWhere(whereExpr);
		if (this.#returningColumns.length > 0) ast = ast.withReturning(buildReturningProjections(this.#tableName, this.#returningColumns, this.#rowFields));
		return buildQueryPlan(ast, this.ctx);
	}
};

//#endregion
//#region src/runtime/table-proxy-impl.ts
var TableProxyImpl = class TableProxyImpl extends BuilderBase {
	#tableName;
	#table;
	#fromSource;
	#scope;
	constructor(tableName, table, alias, ctx) {
		super(ctx);
		this.#tableName = tableName;
		this.#table = table;
		this.#scope = tableToScope(alias, table);
		this.#fromSource = TableSource.named(tableName, alias !== tableName ? alias : void 0);
	}
	lateralJoin = this._gate({ sql: { lateral: true } }, "lateralJoin", (alias, builder) => {
		return this.#toJoined().lateralJoin(alias, builder);
	});
	outerLateralJoin = this._gate({ sql: { lateral: true } }, "outerLateralJoin", (alias, builder) => {
		return this.#toJoined().outerLateralJoin(alias, builder);
	});
	getJoinOuterScope() {
		return this.#scope;
	}
	buildAst() {
		return this.#fromSource;
	}
	as(newAlias) {
		return new TableProxyImpl(this.#tableName, this.#table, newAlias, this.ctx);
	}
	select(...args) {
		return new SelectQueryImpl(emptyState(this.#fromSource, this.#scope), this.ctx).select(...args);
	}
	innerJoin(other, on) {
		return this.#toJoined().innerJoin(other, on);
	}
	outerLeftJoin(other, on) {
		return this.#toJoined().outerLeftJoin(other, on);
	}
	outerRightJoin(other, on) {
		return this.#toJoined().outerRightJoin(other, on);
	}
	outerFullJoin(other, on) {
		return this.#toJoined().outerFullJoin(other, on);
	}
	insert(values) {
		return new InsertQueryImpl(this.#tableName, this.#table, this.#scope, values, this.ctx);
	}
	update(set) {
		return new UpdateQueryImpl(this.#tableName, this.#table, this.#scope, set, this.ctx);
	}
	delete() {
		return new DeleteQueryImpl(this.#tableName, this.#scope, this.ctx);
	}
	#toJoined() {
		return new JoinedTablesImpl(emptyState(this.#fromSource, this.#scope), this.ctx);
	}
};

//#endregion
//#region src/runtime/sql.ts
function sql(options) {
	const { context } = options;
	const ctx = {
		capabilities: context.contract.capabilities,
		queryOperationTypes: context.queryOperations.entries(),
		target: context.contract.target ?? "unknown",
		storageHash: context.contract.storage.storageHash ?? "unknown",
		applyMutationDefaults: (options$1) => context.applyMutationDefaults(options$1)
	};
	return new Proxy({}, { get(_target, prop) {
		const tables = context.contract.storage.tables;
		const table = Object.hasOwn(tables, prop) ? tables[prop] : void 0;
		if (table) return new TableProxyImpl(prop, table, prop, ctx);
	} });
}

//#endregion
export { ExpressionImpl, createAggregateFunctions, createFieldProxy, createFunctions, sql };
//# sourceMappingURL=index.mjs.map