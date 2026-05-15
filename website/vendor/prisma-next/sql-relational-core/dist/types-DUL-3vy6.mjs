//#region src/ast/types.ts
function frozenArrayCopy(values) {
	return Object.freeze([...values]);
}
function frozenOptionalRecordCopy(value) {
	return value === void 0 ? void 0 : Object.freeze({ ...value });
}
function frozenRecordCopy(record) {
	return Object.freeze({ ...record });
}
function freezeRows(rows) {
	return Object.freeze(rows.map((row) => Object.freeze({ ...row })));
}
function combineAll(folder, thunks) {
	let result = folder.empty;
	for (const thunk of thunks) {
		if (folder.isAbsorbing?.(result)) return result;
		result = folder.combine(result, thunk());
	}
	return result;
}
function rewriteComparable(value, rewriter) {
	switch (value.kind) {
		case "param-ref": return rewriter.paramRef ? rewriter.paramRef(value) : value;
		case "literal": return rewriter.literal ? rewriter.literal(value) : value;
		case "list":
			if (rewriter.list) return rewriter.list(value);
			return value.rewrite(rewriter);
		default: return value.rewrite(rewriter);
	}
}
function foldComparable(value, folder) {
	switch (value.kind) {
		case "param-ref": return folder.paramRef ? folder.paramRef(value) : folder.empty;
		case "literal": return folder.literal ? folder.literal(value) : folder.empty;
		case "list": return value.fold(folder);
		default: return value.fold(folder);
	}
}
function collectColumnRefsWith(node) {
	return node.fold({
		empty: [],
		combine: (a, b) => [...a, ...b],
		columnRef: (columnRef) => [columnRef],
		select: (ast) => ast.collectColumnRefs()
	});
}
function collectParamRefsWith(node) {
	return node.fold({
		empty: [],
		combine: (a, b) => [...a, ...b],
		paramRef: (paramRef) => [paramRef],
		select: (ast) => ast.collectParamRefs()
	});
}
function rewriteTableSource(table, rewriter) {
	return rewriter.tableSource ? rewriter.tableSource(table) : table;
}
function rewriteProjectionItem(item, rewriter) {
	const rewrittenExpr = item.expr.kind === "literal" ? rewriter.literal ? rewriter.literal(item.expr) : item.expr : item.expr.rewrite(rewriter);
	return new ProjectionItem(item.alias, rewrittenExpr, item.codecId);
}
function rewriteInsertValue(value, rewriter) {
	switch (value.kind) {
		case "param-ref": return rewriter.paramRef ? rewriteParamRefForInsert(value, rewriter) : value;
		case "column-ref": return rewriter.columnRef ? rewriteColumnRefForInsert(value, rewriter) : value;
		case "default-value": return value;
	}
}
function rewriteParamRefForInsert(value, rewriter) {
	const rewritten = rewriter.paramRef ? rewriter.paramRef(value) : value;
	return rewritten.kind === "param-ref" ? rewritten : value;
}
function rewriteColumnRefForInsert(value, rewriter) {
	const rewritten = rewriter.columnRef ? rewriter.columnRef(value) : value;
	return rewritten.kind === "column-ref" ? rewritten : value;
}
function rewriteInsertRow(row, rewriter) {
	const result = {};
	for (const [key, value] of Object.entries(row)) result[key] = rewriteInsertValue(value, rewriter);
	return result;
}
function rewriteUpdateSetValue(value, rewriter) {
	if (value.kind === "column-ref") {
		const rewritten$1 = rewriter.columnRef ? rewriter.columnRef(value) : value;
		return rewritten$1.kind === "column-ref" ? rewritten$1 : value;
	}
	const rewritten = rewriter.paramRef ? rewriter.paramRef(value) : value;
	return rewritten.kind === "param-ref" ? rewritten : value;
}
function rewriteUpdateSet(set, rewriter) {
	const result = {};
	for (const [key, value] of Object.entries(set)) result[key] = rewriteUpdateSetValue(value, rewriter);
	return result;
}
function rewriteOnConflict(onConflict, rewriter) {
	const columns = onConflict.columns.map((columnRef) => {
		const rewritten = rewriter.columnRef ? rewriter.columnRef(columnRef) : columnRef;
		return rewritten.kind === "column-ref" ? rewritten : columnRef;
	});
	if (onConflict.action.kind === "do-nothing") return new InsertOnConflict(columns, new DoNothingConflictAction());
	return new InsertOnConflict(columns, new DoUpdateSetConflictAction(rewriteUpdateSet(onConflict.action.set, rewriter)));
}
var AstNode = class {
	freeze() {
		Object.freeze(this);
	}
};
var QueryAst = class extends AstNode {};
var FromSource = class extends AstNode {};
var Expression = class extends AstNode {
	collectColumnRefs() {
		return collectColumnRefsWith(this);
	}
	collectParamRefs() {
		return collectParamRefsWith(this);
	}
	baseColumnRef() {
		throw new Error(`${this.constructor.name} does not expose a base column reference`);
	}
	toExpr() {
		return this;
	}
	not() {
		return new NotExpr(this);
	}
};
var TableSource = class TableSource extends FromSource {
	kind = "table-source";
	name;
	alias;
	constructor(name, alias) {
		super();
		this.name = name;
		this.alias = alias;
		this.freeze();
	}
	static named(name, alias) {
		return new TableSource(name, alias);
	}
	rewrite(rewriter) {
		return rewriter.tableSource ? rewriter.tableSource(this) : this;
	}
	toFromSource() {
		return this;
	}
};
var DerivedTableSource = class DerivedTableSource extends FromSource {
	kind = "derived-table-source";
	alias;
	query;
	constructor(alias, query) {
		super();
		this.alias = alias;
		this.query = query;
		this.freeze();
	}
	static as(alias, query) {
		return new DerivedTableSource(alias, query);
	}
	rewrite(rewriter) {
		return new DerivedTableSource(this.alias, this.query.rewrite(rewriter));
	}
	toFromSource() {
		return this;
	}
};
var ColumnRef = class ColumnRef extends Expression {
	kind = "column-ref";
	table;
	column;
	constructor(table, column) {
		super();
		this.table = table;
		this.column = column;
		this.freeze();
	}
	static of(table, column) {
		return new ColumnRef(table, column);
	}
	accept(visitor) {
		return visitor.columnRef(this);
	}
	rewrite(rewriter) {
		return rewriter.columnRef ? rewriter.columnRef(this) : this;
	}
	fold(folder) {
		return folder.columnRef ? folder.columnRef(this) : folder.empty;
	}
	baseColumnRef() {
		return this;
	}
};
var IdentifierRef = class IdentifierRef extends Expression {
	kind = "identifier-ref";
	name;
	constructor(name) {
		super();
		this.name = name;
		this.freeze();
	}
	static of(name) {
		return new IdentifierRef(name);
	}
	accept(visitor) {
		return visitor.identifierRef(this);
	}
	rewrite(rewriter) {
		return rewriter.identifierRef ? rewriter.identifierRef(this) : this;
	}
	fold(folder) {
		return folder.identifierRef ? folder.identifierRef(this) : folder.empty;
	}
};
var ParamRef = class ParamRef extends Expression {
	kind = "param-ref";
	value;
	name;
	codecId;
	constructor(value, options) {
		super();
		this.value = value;
		this.name = options?.name;
		this.codecId = options?.codecId;
		this.freeze();
	}
	static of(value, options) {
		return new ParamRef(value, options);
	}
	accept(visitor) {
		return visitor.param(this);
	}
	rewrite(rewriter) {
		return rewriter.paramRef ? rewriter.paramRef(this) : this;
	}
	fold(folder) {
		return folder.paramRef ? folder.paramRef(this) : folder.empty;
	}
};
var DefaultValueExpr = class extends AstNode {
	kind = "default-value";
	constructor() {
		super();
		this.freeze();
	}
};
var LiteralExpr = class LiteralExpr extends Expression {
	kind = "literal";
	value;
	constructor(value) {
		super();
		this.value = value;
		this.freeze();
	}
	static of(value) {
		return new LiteralExpr(value);
	}
	accept(visitor) {
		return visitor.literal(this);
	}
	rewrite(rewriter) {
		return rewriter.literal ? rewriter.literal(this) : this;
	}
	fold(folder) {
		return folder.literal ? folder.literal(this) : folder.empty;
	}
};
var SubqueryExpr = class SubqueryExpr extends Expression {
	kind = "subquery";
	query;
	constructor(query) {
		super();
		this.query = query;
		this.freeze();
	}
	static of(query) {
		return new SubqueryExpr(query);
	}
	accept(visitor) {
		return visitor.subquery(this);
	}
	rewrite(rewriter) {
		return new SubqueryExpr(this.query.rewrite(rewriter));
	}
	fold(folder) {
		return folder.select ? folder.select(this.query) : folder.empty;
	}
};
var OperationExpr = class OperationExpr extends Expression {
	kind = "operation";
	method;
	self;
	args;
	returns;
	lowering;
	constructor(options) {
		super();
		this.method = options.method;
		this.self = options.self;
		this.args = frozenArrayCopy(options.args ?? []);
		this.returns = options.returns;
		this.lowering = options.lowering;
		this.freeze();
	}
	accept(visitor) {
		return visitor.operation(this);
	}
	rewrite(rewriter) {
		return new OperationExpr({
			method: this.method,
			self: this.self.rewrite(rewriter),
			args: this.args.map((arg) => rewriteComparable(arg, rewriter)),
			returns: this.returns,
			lowering: this.lowering
		});
	}
	fold(folder) {
		return combineAll(folder, [() => this.self.fold(folder), ...this.args.map((arg) => () => foldComparable(arg, folder))]);
	}
	baseColumnRef() {
		return this.self.baseColumnRef();
	}
};
var AggregateExpr = class AggregateExpr extends Expression {
	kind = "aggregate";
	fn;
	expr;
	constructor(fn, expr) {
		super();
		if (fn !== "count" && expr === void 0) throw new Error(`Aggregate function "${fn}" requires an expression`);
		this.fn = fn;
		this.expr = expr;
		this.freeze();
	}
	static count(expr) {
		return new AggregateExpr("count", expr);
	}
	static sum(expr) {
		return new AggregateExpr("sum", expr);
	}
	static avg(expr) {
		return new AggregateExpr("avg", expr);
	}
	static min(expr) {
		return new AggregateExpr("min", expr);
	}
	static max(expr) {
		return new AggregateExpr("max", expr);
	}
	accept(visitor) {
		return visitor.aggregate(this);
	}
	rewrite(rewriter) {
		return this.expr === void 0 ? this : new AggregateExpr(this.fn, this.expr.rewrite(rewriter));
	}
	fold(folder) {
		return this.expr ? this.expr.fold(folder) : folder.empty;
	}
};
var JsonObjectExpr = class JsonObjectExpr extends Expression {
	kind = "json-object";
	entries;
	constructor(entries) {
		super();
		this.entries = frozenArrayCopy(entries.map((entry) => Object.freeze({ ...entry })));
		this.freeze();
	}
	static entry(key, value) {
		return {
			key,
			value
		};
	}
	static fromEntries(entries) {
		return new JsonObjectExpr(entries);
	}
	accept(visitor) {
		return visitor.jsonObject(this);
	}
	rewrite(rewriter) {
		return new JsonObjectExpr(this.entries.map((entry) => ({
			key: entry.key,
			value: entry.value.kind === "literal" ? rewriter.literal ? rewriter.literal(entry.value) : entry.value : entry.value.rewrite(rewriter)
		})));
	}
	fold(folder) {
		return combineAll(folder, this.entries.map((entry) => () => entry.value.kind === "literal" ? folder.literal ? folder.literal(entry.value) : folder.empty : entry.value.fold(folder)));
	}
};
var OrderByItem = class OrderByItem extends AstNode {
	kind = "order-by-item";
	expr;
	dir;
	constructor(expr, dir) {
		super();
		this.expr = expr;
		this.dir = dir;
		this.freeze();
	}
	static asc(expr) {
		return new OrderByItem(expr, "asc");
	}
	static desc(expr) {
		return new OrderByItem(expr, "desc");
	}
	rewrite(rewriter) {
		return new OrderByItem(this.expr.rewrite(rewriter), this.dir);
	}
};
var JsonArrayAggExpr = class JsonArrayAggExpr extends Expression {
	kind = "json-array-agg";
	expr;
	onEmpty;
	orderBy;
	constructor(expr, onEmpty = "null", orderBy) {
		super();
		this.expr = expr;
		this.onEmpty = onEmpty;
		this.orderBy = orderBy && orderBy.length > 0 ? frozenArrayCopy(orderBy) : void 0;
		this.freeze();
	}
	static of(expr, onEmpty = "null", orderBy) {
		return new JsonArrayAggExpr(expr, onEmpty, orderBy);
	}
	accept(visitor) {
		return visitor.jsonArrayAgg(this);
	}
	rewrite(rewriter) {
		return new JsonArrayAggExpr(this.expr.rewrite(rewriter), this.onEmpty, this.orderBy?.map((orderItem) => orderItem.rewrite(rewriter)));
	}
	fold(folder) {
		return combineAll(folder, [() => this.expr.fold(folder), ...(this.orderBy ?? []).map((orderItem) => () => orderItem.expr.fold(folder))]);
	}
};
var ListExpression = class ListExpression extends Expression {
	kind = "list";
	values;
	constructor(values) {
		super();
		this.values = frozenArrayCopy(values);
		this.freeze();
	}
	static of(values) {
		return new ListExpression(values);
	}
	static fromValues(values) {
		return new ListExpression(values.map((value) => new LiteralExpr(value)));
	}
	accept(visitor) {
		return visitor.list(this);
	}
	rewrite(rewriter) {
		if (rewriter.list) return rewriter.list(this);
		return new ListExpression(this.values.map((value) => value.rewrite(rewriter)));
	}
	fold(folder) {
		if (folder.list) return folder.list(this);
		return combineAll(folder, this.values.map((value) => () => value.fold(folder)));
	}
};
var BinaryExpr = class BinaryExpr extends Expression {
	kind = "binary";
	op;
	left;
	right;
	constructor(op, left, right) {
		super();
		this.op = op;
		this.left = left;
		this.right = right;
		this.freeze();
	}
	static eq(left, right) {
		return new BinaryExpr("eq", left, right);
	}
	static neq(left, right) {
		return new BinaryExpr("neq", left, right);
	}
	static gt(left, right) {
		return new BinaryExpr("gt", left, right);
	}
	static lt(left, right) {
		return new BinaryExpr("lt", left, right);
	}
	static gte(left, right) {
		return new BinaryExpr("gte", left, right);
	}
	static lte(left, right) {
		return new BinaryExpr("lte", left, right);
	}
	static like(left, right) {
		return new BinaryExpr("like", left, right);
	}
	static in(left, right) {
		return new BinaryExpr("in", left, right);
	}
	static notIn(left, right) {
		return new BinaryExpr("notIn", left, right);
	}
	accept(visitor) {
		return visitor.binary(this);
	}
	rewrite(rewriter) {
		return new BinaryExpr(this.op, rewriteComparable(this.left, rewriter), rewriteComparable(this.right, rewriter));
	}
	fold(folder) {
		return combineAll(folder, [() => foldComparable(this.left, folder), () => foldComparable(this.right, folder)]);
	}
};
var AndExpr = class AndExpr extends Expression {
	kind = "and";
	exprs;
	constructor(exprs) {
		super();
		this.exprs = frozenArrayCopy(exprs);
		this.freeze();
	}
	static of(exprs) {
		return new AndExpr(exprs);
	}
	static true() {
		return new AndExpr([]);
	}
	accept(visitor) {
		return visitor.and(this);
	}
	rewrite(rewriter) {
		return new AndExpr(this.exprs.map((expr) => expr.rewrite(rewriter)));
	}
	fold(folder) {
		return combineAll(folder, this.exprs.map((expr) => () => expr.fold(folder)));
	}
};
var OrExpr = class OrExpr extends Expression {
	kind = "or";
	exprs;
	constructor(exprs) {
		super();
		this.exprs = frozenArrayCopy(exprs);
		this.freeze();
	}
	static of(exprs) {
		return new OrExpr(exprs);
	}
	static false() {
		return new OrExpr([]);
	}
	accept(visitor) {
		return visitor.or(this);
	}
	rewrite(rewriter) {
		return new OrExpr(this.exprs.map((expr) => expr.rewrite(rewriter)));
	}
	fold(folder) {
		return combineAll(folder, this.exprs.map((expr) => () => expr.fold(folder)));
	}
};
var ExistsExpr = class ExistsExpr extends Expression {
	kind = "exists";
	notExists;
	subquery;
	constructor(subquery, notExists = false) {
		super();
		this.notExists = notExists;
		this.subquery = subquery;
		this.freeze();
	}
	static exists(subquery) {
		return new ExistsExpr(subquery, false);
	}
	static notExists(subquery) {
		return new ExistsExpr(subquery, true);
	}
	accept(visitor) {
		return visitor.exists(this);
	}
	rewrite(rewriter) {
		return new ExistsExpr(this.subquery.rewrite(rewriter), this.notExists);
	}
	fold(folder) {
		return folder.select ? folder.select(this.subquery) : folder.empty;
	}
};
var NullCheckExpr = class NullCheckExpr extends Expression {
	kind = "null-check";
	expr;
	isNull;
	constructor(expr, isNull) {
		super();
		this.expr = expr;
		this.isNull = isNull;
		this.freeze();
	}
	static isNull(expr) {
		return new NullCheckExpr(expr, true);
	}
	static isNotNull(expr) {
		return new NullCheckExpr(expr, false);
	}
	accept(visitor) {
		return visitor.nullCheck(this);
	}
	rewrite(rewriter) {
		return new NullCheckExpr(this.expr.rewrite(rewriter), this.isNull);
	}
	fold(folder) {
		return this.expr.fold(folder);
	}
};
var NotExpr = class NotExpr extends Expression {
	kind = "not";
	expr;
	constructor(expr) {
		super();
		this.expr = expr;
		this.freeze();
	}
	toWhereExpr() {
		return this;
	}
	accept(visitor) {
		return visitor.not(this);
	}
	rewrite(rewriter) {
		return new NotExpr(this.expr.rewrite(rewriter));
	}
	fold(folder) {
		return this.expr.fold(folder);
	}
};
var EqColJoinOn = class EqColJoinOn extends AstNode {
	kind = "eq-col-join-on";
	left;
	right;
	constructor(left, right) {
		super();
		this.left = left;
		this.right = right;
		this.freeze();
	}
	static of(left, right) {
		return new EqColJoinOn(left, right);
	}
	rewrite(rewriter) {
		return rewriter.eqColJoinOn ? rewriter.eqColJoinOn(this) : this;
	}
};
var JoinAst = class JoinAst extends AstNode {
	kind = "join";
	joinType;
	source;
	lateral;
	on;
	constructor(joinType, source, on, lateral = false) {
		super();
		this.joinType = joinType;
		this.source = source;
		this.lateral = lateral;
		this.on = on;
		this.freeze();
	}
	static inner(source, on, lateral = false) {
		return new JoinAst("inner", source, on, lateral);
	}
	static left(source, on, lateral = false) {
		return new JoinAst("left", source, on, lateral);
	}
	static right(source, on, lateral = false) {
		return new JoinAst("right", source, on, lateral);
	}
	static full(source, on, lateral = false) {
		return new JoinAst("full", source, on, lateral);
	}
	rewrite(rewriter) {
		return new JoinAst(this.joinType, this.source.rewrite(rewriter), this.on.kind === "eq-col-join-on" ? this.on.rewrite(rewriter) : this.on.rewrite(rewriter), this.lateral);
	}
};
var ProjectionItem = class ProjectionItem extends AstNode {
	kind = "projection-item";
	alias;
	expr;
	codecId;
	constructor(alias, expr, codecId) {
		super();
		this.alias = alias;
		this.expr = expr;
		this.codecId = codecId;
		this.freeze();
	}
	static of(alias, expr, codecId) {
		return new ProjectionItem(alias, expr, codecId);
	}
	withCodecId(codecId) {
		return new ProjectionItem(this.alias, this.expr, codecId);
	}
};
var SelectAst = class SelectAst extends QueryAst {
	kind = "select";
	from;
	joins;
	projection;
	where;
	orderBy;
	distinct;
	distinctOn;
	groupBy;
	having;
	limit;
	offset;
	selectAllIntent;
	constructor(options) {
		super();
		this.from = options.from;
		this.joins = options.joins && options.joins.length > 0 ? frozenArrayCopy(options.joins) : void 0;
		this.projection = frozenArrayCopy(options.projection);
		this.where = options.where;
		this.orderBy = options.orderBy && options.orderBy.length > 0 ? frozenArrayCopy(options.orderBy) : void 0;
		this.distinct = options.distinct;
		this.distinctOn = options.distinctOn && options.distinctOn.length > 0 ? frozenArrayCopy(options.distinctOn) : void 0;
		this.groupBy = options.groupBy && options.groupBy.length > 0 ? frozenArrayCopy(options.groupBy) : void 0;
		this.having = options.having;
		this.limit = options.limit;
		this.offset = options.offset;
		this.selectAllIntent = frozenOptionalRecordCopy(options.selectAllIntent);
		this.freeze();
	}
	static from(from) {
		return new SelectAst({
			from,
			joins: void 0,
			projection: [],
			where: void 0,
			orderBy: void 0,
			distinct: void 0,
			distinctOn: void 0,
			groupBy: void 0,
			having: void 0,
			limit: void 0,
			offset: void 0,
			selectAllIntent: void 0
		});
	}
	withFrom(from) {
		return new SelectAst({
			...this,
			from
		});
	}
	withJoins(joins) {
		return new SelectAst({
			...this,
			joins: joins.length > 0 ? joins : void 0
		});
	}
	withProjection(projection) {
		return new SelectAst({
			...this,
			projection
		});
	}
	addProjection(alias, expr) {
		return new SelectAst({
			...this,
			projection: [...this.projection, new ProjectionItem(alias, expr)]
		});
	}
	withWhere(where) {
		return new SelectAst({
			...this,
			where
		});
	}
	withOrderBy(orderBy) {
		return new SelectAst({
			...this,
			orderBy: orderBy.length > 0 ? orderBy : void 0
		});
	}
	withDistinct(enabled = true) {
		return new SelectAst({
			...this,
			distinct: enabled ? true : void 0
		});
	}
	withDistinctOn(distinctOn) {
		return new SelectAst({
			...this,
			distinctOn: distinctOn.length > 0 ? distinctOn : void 0
		});
	}
	withGroupBy(groupBy) {
		return new SelectAst({
			...this,
			groupBy: groupBy.length > 0 ? groupBy : void 0
		});
	}
	withHaving(having) {
		return new SelectAst({
			...this,
			having
		});
	}
	withLimit(limit) {
		return new SelectAst({
			...this,
			limit
		});
	}
	withOffset(offset) {
		return new SelectAst({
			...this,
			offset
		});
	}
	withSelectAllIntent(selectAllIntent) {
		return new SelectAst({
			...this,
			selectAllIntent
		});
	}
	rewrite(rewriter) {
		const rewritten = new SelectAst({
			from: this.from.rewrite(rewriter),
			joins: this.joins?.map((join) => join.rewrite(rewriter)),
			projection: this.projection.map((projection) => new ProjectionItem(projection.alias, projection.expr.kind === "literal" ? rewriter.literal ? rewriter.literal(projection.expr) : projection.expr : projection.expr.rewrite(rewriter), projection.codecId)),
			where: this.where?.rewrite(rewriter),
			orderBy: this.orderBy?.map((orderItem) => orderItem.rewrite(rewriter)),
			distinct: this.distinct,
			distinctOn: this.distinctOn?.map((expr) => expr.rewrite(rewriter)),
			groupBy: this.groupBy?.map((expr) => expr.rewrite(rewriter)),
			having: this.having?.rewrite(rewriter),
			limit: this.limit,
			offset: this.offset,
			selectAllIntent: this.selectAllIntent
		});
		return rewriter.select ? rewriter.select(rewritten) : rewritten;
	}
	collectColumnRefs() {
		const refs = [];
		const pushRefs = (columns) => {
			refs.push(...columns);
		};
		if (this.from.kind === "derived-table-source") pushRefs(this.from.query.collectColumnRefs());
		for (const projection of this.projection) if (!(projection.expr.kind === "literal")) pushRefs(projection.expr.collectColumnRefs());
		if (this.where) pushRefs(this.where.collectColumnRefs());
		if (this.having) pushRefs(this.having.collectColumnRefs());
		for (const orderItem of this.orderBy ?? []) pushRefs(orderItem.expr.collectColumnRefs());
		for (const expr of this.distinctOn ?? []) pushRefs(expr.collectColumnRefs());
		for (const expr of this.groupBy ?? []) pushRefs(expr.collectColumnRefs());
		for (const join of this.joins ?? []) {
			if (join.source.kind === "derived-table-source") pushRefs(join.source.query.collectColumnRefs());
			if (join.on.kind === "eq-col-join-on") refs.push(join.on.left, join.on.right);
			else pushRefs(join.on.collectColumnRefs());
		}
		return refs;
	}
	collectParamRefs() {
		const refs = [];
		const pushRefs = (params) => {
			refs.push(...params);
		};
		if (this.from.kind === "derived-table-source") pushRefs(this.from.query.collectParamRefs());
		for (const projection of this.projection) if (!(projection.expr.kind === "literal")) pushRefs(projection.expr.collectParamRefs());
		if (this.where) pushRefs(this.where.collectParamRefs());
		if (this.having) pushRefs(this.having.collectParamRefs());
		for (const orderItem of this.orderBy ?? []) pushRefs(orderItem.expr.collectParamRefs());
		for (const expr of this.distinctOn ?? []) pushRefs(expr.collectParamRefs());
		for (const expr of this.groupBy ?? []) pushRefs(expr.collectParamRefs());
		for (const join of this.joins ?? []) {
			if (join.source.kind === "derived-table-source") pushRefs(join.source.query.collectParamRefs());
			if (!(join.on.kind === "eq-col-join-on")) pushRefs(join.on.collectParamRefs());
		}
		return refs;
	}
	toQueryAst() {
		return this;
	}
};
var InsertOnConflictAction = class extends AstNode {};
var DoNothingConflictAction = class extends InsertOnConflictAction {
	kind = "do-nothing";
	constructor() {
		super();
		this.freeze();
	}
	toInsertOnConflictAction() {
		return this;
	}
};
var DoUpdateSetConflictAction = class extends InsertOnConflictAction {
	kind = "do-update-set";
	set;
	constructor(set) {
		super();
		this.set = frozenRecordCopy(set);
		this.freeze();
	}
	toInsertOnConflictAction() {
		return this;
	}
};
var InsertOnConflict = class InsertOnConflict extends AstNode {
	kind = "insert-on-conflict";
	columns;
	action;
	constructor(columns, action) {
		super();
		this.columns = frozenArrayCopy(columns);
		this.action = action;
		this.freeze();
	}
	static on(columns) {
		return new InsertOnConflict(columns, new DoNothingConflictAction());
	}
	doNothing() {
		return new InsertOnConflict(this.columns, new DoNothingConflictAction());
	}
	doUpdateSet(set) {
		return new InsertOnConflict(this.columns, new DoUpdateSetConflictAction(set));
	}
};
var InsertAst = class InsertAst extends QueryAst {
	kind = "insert";
	table;
	rows;
	onConflict;
	returning;
	constructor(table, rows = [{}], onConflict, returning) {
		super();
		this.table = table;
		this.rows = freezeRows(rows);
		this.onConflict = onConflict;
		this.returning = returning && returning.length > 0 ? frozenArrayCopy(returning) : void 0;
		this.freeze();
	}
	static into(table) {
		return new InsertAst(table);
	}
	withValues(values) {
		return new InsertAst(this.table, [{ ...values }], this.onConflict, this.returning);
	}
	withRows(rows) {
		return new InsertAst(this.table, rows.map((row) => ({ ...row })), this.onConflict, this.returning);
	}
	withReturning(returning) {
		return new InsertAst(this.table, this.rows.map((row) => ({ ...row })), this.onConflict, returning);
	}
	withOnConflict(onConflict) {
		return new InsertAst(this.table, this.rows.map((row) => ({ ...row })), onConflict, this.returning);
	}
	rewrite(rewriter) {
		return new InsertAst(rewriteTableSource(this.table, rewriter), this.rows.map((row) => rewriteInsertRow(row, rewriter)), this.onConflict ? rewriteOnConflict(this.onConflict, rewriter) : void 0, this.returning?.map((item) => rewriteProjectionItem(item, rewriter)));
	}
	collectParamRefs() {
		const refs = [];
		for (const row of this.rows) for (const value of Object.values(row)) if (value.kind === "param-ref") refs.push(value);
		if (this.onConflict?.action.kind === "do-update-set") {
			for (const value of Object.values(this.onConflict.action.set)) if (value.kind === "param-ref") refs.push(value);
		}
		for (const item of this.returning ?? []) if (item.expr.kind !== "literal") refs.push(...item.expr.collectParamRefs());
		return refs;
	}
	toQueryAst() {
		return this;
	}
};
var UpdateAst = class UpdateAst extends QueryAst {
	kind = "update";
	table;
	set;
	where;
	returning;
	constructor(table, set = {}, where, returning) {
		super();
		this.table = table;
		this.set = frozenRecordCopy(set);
		this.where = where;
		this.returning = returning && returning.length > 0 ? frozenArrayCopy(returning) : void 0;
		this.freeze();
	}
	static table(table) {
		return new UpdateAst(table);
	}
	withSet(set) {
		return new UpdateAst(this.table, set, this.where, this.returning);
	}
	withWhere(where) {
		return new UpdateAst(this.table, this.set, where, this.returning);
	}
	withReturning(returning) {
		return new UpdateAst(this.table, this.set, this.where, returning);
	}
	rewrite(rewriter) {
		return new UpdateAst(rewriteTableSource(this.table, rewriter), rewriteUpdateSet(this.set, rewriter), this.where?.rewrite(rewriter), this.returning?.map((item) => rewriteProjectionItem(item, rewriter)));
	}
	collectParamRefs() {
		const refs = [];
		for (const value of Object.values(this.set)) if (value.kind === "param-ref") refs.push(value);
		if (this.where) refs.push(...this.where.collectParamRefs());
		for (const item of this.returning ?? []) if (item.expr.kind !== "literal") refs.push(...item.expr.collectParamRefs());
		return refs;
	}
	toQueryAst() {
		return this;
	}
};
var DeleteAst = class DeleteAst extends QueryAst {
	kind = "delete";
	table;
	where;
	returning;
	constructor(table, where, returning) {
		super();
		this.table = table;
		this.where = where;
		this.returning = returning && returning.length > 0 ? frozenArrayCopy(returning) : void 0;
		this.freeze();
	}
	static from(table) {
		return new DeleteAst(table);
	}
	withWhere(where) {
		return new DeleteAst(this.table, where, this.returning);
	}
	withReturning(returning) {
		return new DeleteAst(this.table, this.where, returning);
	}
	rewrite(rewriter) {
		return new DeleteAst(rewriteTableSource(this.table, rewriter), this.where?.rewrite(rewriter), this.returning?.map((item) => rewriteProjectionItem(item, rewriter)));
	}
	collectParamRefs() {
		const refs = [];
		if (this.where) refs.push(...this.where.collectParamRefs());
		for (const item of this.returning ?? []) if (item.expr.kind !== "literal") refs.push(...item.expr.collectParamRefs());
		return refs;
	}
	toQueryAst() {
		return this;
	}
};
const queryAstKinds = new Set([
	"select",
	"insert",
	"update",
	"delete"
]);
const whereExprKinds = new Set([
	"binary",
	"and",
	"or",
	"exists",
	"null-check",
	"not"
]);
function isQueryAst(value) {
	return typeof value === "object" && value !== null && "kind" in value && queryAstKinds.has(value.kind);
}
function isWhereExpr(value) {
	return typeof value === "object" && value !== null && "kind" in value && whereExprKinds.has(value.kind);
}

//#endregion
export { UpdateAst as A, OrExpr as C, SelectAst as D, ProjectionItem as E, isWhereExpr as M, queryAstKinds as N, SubqueryExpr as O, whereExprKinds as P, OperationExpr as S, ParamRef as T, JsonObjectExpr as _, DefaultValueExpr as a, NotExpr as b, DoNothingConflictAction as c, ExistsExpr as d, IdentifierRef as f, JsonArrayAggExpr as g, JoinAst as h, ColumnRef as i, isQueryAst as j, TableSource as k, DoUpdateSetConflictAction as l, InsertOnConflict as m, AndExpr as n, DeleteAst as o, InsertAst as p, BinaryExpr as r, DerivedTableSource as s, AggregateExpr as t, EqColJoinOn as u, ListExpression as v, OrderByItem as w, NullCheckExpr as x, LiteralExpr as y };
//# sourceMappingURL=types-DUL-3vy6.mjs.map