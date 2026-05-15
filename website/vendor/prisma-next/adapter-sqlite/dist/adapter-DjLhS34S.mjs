import { createCodecRegistry } from "@prisma-next/sql-relational-core/ast";
import { parseContractMarkerRow } from "@prisma-next/sql-runtime";
import { codecDefinitions } from "@prisma-next/target-sqlite/codecs";
import { escapeLiteral, quoteIdentifier } from "@prisma-next/target-sqlite/sql-utils";

//#region src/core/adapter.ts
const defaultCapabilities = Object.freeze({ sql: {
	orderBy: true,
	limit: true,
	lateral: false,
	jsonAgg: true,
	returning: true,
	enums: false
} });
var SqliteAdapterImpl = class {
	familyId = "sql";
	targetId = "sqlite";
	profile;
	codecRegistry = (() => {
		const registry = createCodecRegistry();
		for (const definition of Object.values(codecDefinitions)) registry.register(definition.codec);
		return registry;
	})();
	constructor(options) {
		this.profile = Object.freeze({
			id: options?.profileId ?? "sqlite/default@1",
			target: "sqlite",
			capabilities: defaultCapabilities,
			codecs: () => this.codecRegistry,
			readMarkerStatement: () => ({
				sql: "select core_hash, profile_hash, contract_json, canonical_version, updated_at, app_tag, meta, invariants from _prisma_marker where id = ?",
				params: [1]
			}),
			parseMarkerRow: (row) => {
				const raw = row;
				const invariants = typeof raw["invariants"] === "string" ? JSON.parse(raw["invariants"]) : raw["invariants"];
				return parseContractMarkerRow({
					...raw,
					invariants
				});
			}
		});
	}
	parameterizedCodecs() {
		return [];
	}
	lower(ast, context) {
		return renderLoweredSql(ast, context.contract);
	}
};
/**
* Lower a SQL query AST into a SQLite-flavored `{ sql, params }` payload.
*
* Shared between the runtime adapter (`SqliteAdapterImpl.lower`) and the
* control adapter (`SqliteControlAdapter.lower`) so both produce
* byte-identical SQL for the same AST and contract.
*/
function renderLoweredSql(ast, contract) {
	const collectedParamRefs = ast.collectParamRefs();
	const params = [];
	for (const ref of collectedParamRefs) params.push(ref.value);
	let sql;
	const node = ast;
	switch (node.kind) {
		case "select":
			sql = renderSelect(node, contract);
			break;
		case "insert":
			sql = renderInsert(node);
			break;
		case "update":
			sql = renderUpdate(node, contract);
			break;
		case "delete":
			sql = renderDelete(node);
			break;
		default: throw new Error(`Unsupported AST node kind: ${node.kind}`);
	}
	return Object.freeze({
		sql,
		params
	});
}
function renderSelect(ast, contract) {
	return [
		`SELECT ${ast.distinct ? "DISTINCT " : ""}${renderProjection(ast.projection, contract)}`,
		`FROM ${renderSource(ast.from, contract)}`,
		ast.joins?.length ? ast.joins.map((join) => renderJoin(join, contract)).join(" ") : "",
		ast.where ? `WHERE ${renderExpr(ast.where, contract)}` : "",
		ast.groupBy?.length ? `GROUP BY ${ast.groupBy.map((expr) => renderExpr(expr, contract)).join(", ")}` : "",
		ast.having ? `HAVING ${renderExpr(ast.having, contract)}` : "",
		ast.orderBy?.length ? `ORDER BY ${ast.orderBy.map((order) => `${renderExpr(order.expr, contract)} ${order.dir.toUpperCase()}`).join(", ")}` : "",
		typeof ast.limit === "number" ? `LIMIT ${ast.limit}` : "",
		typeof ast.offset === "number" ? `OFFSET ${ast.offset}` : ""
	].filter((part) => part.length > 0).join(" ").trim();
}
function renderProjection(projection, contract) {
	return projection.map((item) => {
		const alias = quoteIdentifier(item.alias);
		if (item.expr.kind === "literal") return `${renderLiteral(item.expr)} AS ${alias}`;
		return `${renderExpr(item.expr, contract)} AS ${alias}`;
	}).join(", ");
}
function renderSource(source, contract) {
	const node = source;
	switch (node.kind) {
		case "table-source": {
			const table = quoteIdentifier(node.name);
			if (!node.alias) return table;
			return `${table} AS ${quoteIdentifier(node.alias)}`;
		}
		case "derived-table-source": return `(${renderSelect(node.query, contract)}) AS ${quoteIdentifier(node.alias)}`;
		default: throw new Error(`Unsupported source node kind: ${node.kind}`);
	}
}
function renderExpr(expr, contract) {
	const node = expr;
	switch (node.kind) {
		case "column-ref": return renderColumn(node);
		case "identifier-ref": return quoteIdentifier(node.name);
		case "operation": return renderOperation(node, contract);
		case "subquery": return renderSubqueryExpr(node, contract);
		case "aggregate": return renderAggregateExpr(node, contract);
		case "json-object": return renderJsonObjectExpr(node, contract);
		case "json-array-agg": return renderJsonArrayAggExpr(node, contract);
		case "binary": return renderBinary(node, contract);
		case "and":
			if (node.exprs.length === 0) return "TRUE";
			return `(${node.exprs.map((part) => renderExpr(part, contract)).join(" AND ")})`;
		case "or":
			if (node.exprs.length === 0) return "FALSE";
			return `(${node.exprs.map((part) => renderExpr(part, contract)).join(" OR ")})`;
		case "exists": return `${node.notExists ? "NOT " : ""}EXISTS (${renderSelect(node.subquery, contract)})`;
		case "null-check": return renderNullCheck(node, contract);
		case "not": return `NOT (${renderExpr(node.expr, contract)})`;
		case "param-ref": return "?";
		case "literal": return renderLiteral(node);
		case "list": return renderListLiteral(node);
		default: throw new Error(`Unsupported expression node kind: ${node.kind}`);
	}
}
function renderColumn(ref) {
	if (ref.table === "excluded") return `excluded.${quoteIdentifier(ref.column)}`;
	return `${quoteIdentifier(ref.table)}.${quoteIdentifier(ref.column)}`;
}
function renderLiteral(expr) {
	if (typeof expr.value === "string") return `'${escapeLiteral(expr.value)}'`;
	if (typeof expr.value === "number" || typeof expr.value === "boolean") return String(expr.value);
	if (typeof expr.value === "bigint") return String(expr.value);
	if (expr.value === null || expr.value === void 0) return "NULL";
	if (expr.value instanceof Date) return `'${escapeLiteral(expr.value.toISOString())}'`;
	const json = JSON.stringify(expr.value);
	if (json === void 0) return "NULL";
	return `'${escapeLiteral(json)}'`;
}
function renderOperation(expr, contract) {
	const self = renderExpr(expr.self, contract);
	const args = expr.args.map((arg) => renderExpr(arg, contract));
	let result = expr.lowering.template;
	result = result.replace(/\{\{self\}\}/g, self);
	for (let i = 0; i < args.length; i++) result = result.replace(new RegExp(`\\{\\{arg${i}\\}\\}`, "g"), args[i] ?? "");
	return result;
}
function renderSubqueryExpr(expr, contract) {
	if (expr.query.projection.length !== 1) throw new Error("Subquery expressions must project exactly one column");
	return `(${renderSelect(expr.query, contract)})`;
}
function renderNullCheck(expr, contract) {
	const rendered = renderExpr(expr.expr, contract);
	const renderedExpr = expr.expr.kind === "operation" || expr.expr.kind === "subquery" ? `(${rendered})` : rendered;
	return expr.isNull ? `${renderedExpr} IS NULL` : `${renderedExpr} IS NOT NULL`;
}
function renderBinary(expr, contract) {
	if (expr.right.kind === "list" && expr.right.values.length === 0) {
		if (expr.op === "in") return "FALSE";
		if (expr.op === "notIn") return "TRUE";
	}
	const leftExpr = expr.left;
	const left = renderExpr(leftExpr, contract);
	const leftRendered = leftExpr.kind === "operation" || leftExpr.kind === "subquery" ? `(${left})` : left;
	const rightNode = expr.right;
	let right;
	switch (rightNode.kind) {
		case "list":
			right = renderListLiteral(rightNode);
			break;
		case "literal":
			right = renderLiteral(rightNode);
			break;
		case "column-ref":
			right = renderColumn(rightNode);
			break;
		case "param-ref":
			right = "?";
			break;
		default:
			right = renderExpr(rightNode, contract);
			break;
	}
	return `${leftRendered} ${{
		eq: "=",
		neq: "!=",
		gt: ">",
		lt: "<",
		gte: ">=",
		lte: "<=",
		like: "LIKE",
		in: "IN",
		notIn: "NOT IN"
	}[expr.op]} ${right}`;
}
function renderListLiteral(expr) {
	if (expr.values.length === 0) return "(NULL)";
	return `(${expr.values.map((v) => {
		if (v.kind === "param-ref") return "?";
		if (v.kind === "literal") return renderLiteral(v);
		return renderExpr(v);
	}).join(", ")})`;
}
function renderAggregateExpr(expr, contract) {
	const fn = expr.fn.toUpperCase();
	if (!expr.expr) return `${fn}(*)`;
	return `${fn}(${renderExpr(expr.expr, contract)})`;
}
function renderJsonObjectExpr(expr, contract) {
	return `json_object(${expr.entries.flatMap((entry) => {
		const key = `'${escapeLiteral(entry.key)}'`;
		if (entry.value.kind === "literal") return [key, renderLiteral(entry.value)];
		return [key, renderExpr(entry.value, contract)];
	}).join(", ")})`;
}
function renderOrderByItems(items, contract) {
	return items.map((item) => `${renderExpr(item.expr, contract)} ${item.dir.toUpperCase()}`).join(", ");
}
function renderJsonArrayAggExpr(expr, contract) {
	const aggregateOrderBy = expr.orderBy && expr.orderBy.length > 0 ? ` ORDER BY ${renderOrderByItems(expr.orderBy, contract)}` : "";
	const aggregated = `json_group_array(${renderExpr(expr.expr, contract)}${aggregateOrderBy})`;
	if (expr.onEmpty === "emptyArray") return `coalesce(${aggregated}, '[]')`;
	return aggregated;
}
function renderJoin(join, contract) {
	return `${join.joinType.toUpperCase()} JOIN ${renderSource(join.source, contract)} ON ${renderJoinOn(join.on, contract)}`;
}
function renderJoinOn(on, contract) {
	if (on.kind === "eq-col-join-on") return `${renderColumn(on.left)} = ${renderColumn(on.right)}`;
	return renderExpr(on, contract);
}
function renderInsertValue(value) {
	switch (value.kind) {
		case "param-ref": return "?";
		case "column-ref": return renderColumn(value);
		case "default-value": throw new Error("SQLite does not support DEFAULT as a value in INSERT ... VALUES");
		default: throw new Error(`Unsupported value node in INSERT: ${value.kind}`);
	}
}
function renderInsert(ast) {
	const table = quoteIdentifier(ast.table.name);
	const rows = ast.rows;
	if (rows.length === 0) throw new Error("INSERT requires at least one row");
	const firstRow = rows[0];
	const columnOrder = Object.keys(firstRow);
	let insertClause;
	if (columnOrder.length === 0) insertClause = `INSERT INTO ${table} DEFAULT VALUES`;
	else {
		const columns = columnOrder.map((column) => quoteIdentifier(column));
		const values = rows.map((row) => {
			return `(${columnOrder.map((column) => {
				const value = row[column];
				if (value === void 0) throw new Error(`Missing value for column "${column}" in INSERT row`);
				return renderInsertValue(value);
			}).join(", ")})`;
		}).join(", ");
		insertClause = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values}`;
	}
	let onConflictClause = "";
	if (ast.onConflict) {
		const conflictColumns = ast.onConflict.columns.map((col) => quoteIdentifier(col.column));
		if (conflictColumns.length === 0) throw new Error("INSERT onConflict requires at least one conflict column");
		const action = ast.onConflict.action;
		switch (action.kind) {
			case "do-nothing":
				onConflictClause = ` ON CONFLICT (${conflictColumns.join(", ")}) DO NOTHING`;
				break;
			case "do-update-set": {
				const updates = Object.entries(action.set).map(([colName, value]) => {
					const target = quoteIdentifier(colName);
					if (value.kind === "param-ref") return `${target} = ?`;
					return `${target} = ${renderColumn(value)}`;
				});
				onConflictClause = ` ON CONFLICT (${conflictColumns.join(", ")}) DO UPDATE SET ${updates.join(", ")}`;
				break;
			}
			default: throw new Error(`Unsupported onConflict action: ${action.kind}`);
		}
	}
	const returningClause = renderReturning(ast.returning);
	return `${insertClause}${onConflictClause}${returningClause}`;
}
function renderUpdate(ast, contract) {
	const table = quoteIdentifier(ast.table.name);
	const setClauses = Object.entries(ast.set).map(([col, val]) => {
		const column = quoteIdentifier(col);
		let value;
		switch (val.kind) {
			case "param-ref":
				value = "?";
				break;
			case "column-ref":
				value = renderColumn(val);
				break;
			default: throw new Error(`Unsupported value node in UPDATE: ${val.kind}`);
		}
		return `${column} = ${value}`;
	});
	const whereClause = ast.where ? ` WHERE ${renderExpr(ast.where, contract)}` : "";
	const returningClause = renderReturning(ast.returning);
	return `UPDATE ${table} SET ${setClauses.join(", ")}${whereClause}${returningClause}`;
}
function renderDelete(ast) {
	return `DELETE FROM ${quoteIdentifier(ast.table.name)}${ast.where ? ` WHERE ${renderExpr(ast.where)}` : ""}${renderReturning(ast.returning)}`;
}
function renderReturning(returning) {
	if (!returning?.length) return "";
	return ` RETURNING ${returning.map((item) => {
		if (item.expr.kind === "column-ref") {
			const rendered = `${quoteIdentifier(item.expr.table)}.${quoteIdentifier(item.expr.column)}`;
			return item.expr.column === item.alias ? rendered : `${rendered} AS ${quoteIdentifier(item.alias)}`;
		}
		return `${renderExpr(item.expr)} AS ${quoteIdentifier(item.alias)}`;
	}).join(", ")}`;
}
function createSqliteAdapter(options) {
	return Object.freeze(new SqliteAdapterImpl(options));
}

//#endregion
export { renderLoweredSql as n, createSqliteAdapter as t };
//# sourceMappingURL=adapter-DjLhS34S.mjs.map