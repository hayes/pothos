import { A as UpdateAst, C as OrExpr, D as SelectAst, E as ProjectionItem, M as isWhereExpr, N as queryAstKinds, O as SubqueryExpr, P as whereExprKinds, S as OperationExpr, T as ParamRef, _ as JsonObjectExpr, a as DefaultValueExpr, b as NotExpr, c as DoNothingConflictAction, d as ExistsExpr, f as IdentifierRef, g as JsonArrayAggExpr, h as JoinAst, i as ColumnRef, j as isQueryAst, k as TableSource, l as DoUpdateSetConflictAction, m as InsertOnConflict, n as AndExpr, o as DeleteAst, p as InsertAst, r as BinaryExpr, s as DerivedTableSource, t as AggregateExpr, u as EqColJoinOn, v as ListExpression, w as OrderByItem, x as NullCheckExpr, y as LiteralExpr } from "../types-DUL-3vy6.mjs";
import { ifDefined } from "@prisma-next/utils/defined";
import { type } from "arktype";

//#region src/ast/codec-types.ts
/**
* Implementation of CodecRegistry.
*/
var CodecRegistryImpl = class {
	_byId = /* @__PURE__ */ new Map();
	_byScalar = /* @__PURE__ */ new Map();
	/**
	* Map-like interface for codec lookup by ID.
	* Example: registry.get('pg/text@1')
	*/
	get(id) {
		return this._byId.get(id);
	}
	/**
	* Check if a codec with the given ID is registered.
	*/
	has(id) {
		return this._byId.has(id);
	}
	/**
	* Get all codecs that handle a given scalar type.
	* Returns an empty frozen array if no codecs are found.
	* Example: registry.getByScalar('text') → [codec1, codec2, ...]
	*/
	getByScalar(scalar) {
		return this._byScalar.get(scalar) ?? Object.freeze([]);
	}
	/**
	* Get the default codec for a scalar type (first registered codec).
	* Returns undefined if no codec handles this scalar type.
	*/
	getDefaultCodec(scalar) {
		return this._byScalar.get(scalar)?.[0];
	}
	/**
	* Register a codec in the registry.
	* Throws an error if a codec with the same ID is already registered.
	*
	* @param codec - The codec to register
	* @throws Error if a codec with the same ID already exists
	*/
	register(codec$1) {
		if (this._byId.has(codec$1.id)) throw new Error(`Codec with ID '${codec$1.id}' is already registered`);
		this._byId.set(codec$1.id, codec$1);
		for (const scalarType of codec$1.targetTypes) {
			const existing = this._byScalar.get(scalarType);
			if (existing) existing.push(codec$1);
			else this._byScalar.set(scalarType, [codec$1]);
		}
	}
	hasTrait(codecId, trait) {
		return this._byId.get(codecId)?.traits?.includes(trait) ?? false;
	}
	traitsOf(codecId) {
		return this._byId.get(codecId)?.traits ?? [];
	}
	/**
	* Returns an iterator over all registered codecs.
	* Useful for iterating through codecs from another registry.
	*/
	*[Symbol.iterator]() {
		for (const codec$1 of this._byId.values()) yield codec$1;
	}
	/**
	* Returns an iterable of all registered codecs.
	*/
	values() {
		return this._byId.values();
	}
};
/**
* Construct a SQL codec from author functions and optional metadata.
*
* Author `encode` and `decode` as sync or async functions; the factory
* produces a {@link Codec} whose query-time methods follow the boundary
* contract documented on `Codec`. Authors receive a second `ctx` options
* argument carrying the SQL-family per-call context; ignore it if you
* don't need it.
*
* Both `encode` and `decode` are required so `TInput` and `TWire` are
* always covered by an explicit author function — the factory installs
* no identity fallback. `encodeJson` and `decodeJson` default to identity
* **only when `TInput` is assignable to `JsonValue`**; otherwise both are
* required so the contract artifact stays JSON-safe.
*/
function codec(config) {
	const identity = (v) => v;
	const userEncode = config.encode;
	const userDecode = config.decode;
	const widenedConfig = config;
	return {
		id: config.typeId,
		targetTypes: config.targetTypes,
		...ifDefined("meta", config.meta),
		...ifDefined("paramsSchema", config.paramsSchema),
		...ifDefined("init", config.init),
		...ifDefined("traits", config.traits ? Object.freeze([...config.traits]) : void 0),
		...ifDefined("renderOutputType", config.renderOutputType),
		encode: (value, ctx) => {
			try {
				return Promise.resolve(userEncode(value, ctx));
			} catch (error) {
				return Promise.reject(error);
			}
		},
		decode: (wire, ctx) => {
			try {
				return Promise.resolve(userDecode(wire, ctx));
			} catch (error) {
				return Promise.reject(error);
			}
		},
		encodeJson: widenedConfig.encodeJson ?? identity,
		decodeJson: widenedConfig.decodeJson ?? identity
	};
}
/**
* Implementation of CodecDefBuilder.
*/
var CodecDefBuilderImpl = class CodecDefBuilderImpl {
	_codecs;
	CodecTypes;
	dataTypes;
	constructor(codecs$1) {
		this._codecs = codecs$1;
		const codecTypes = {};
		for (const [, codecImpl] of Object.entries(this._codecs)) {
			const codecImplTyped = codecImpl;
			codecTypes[codecImplTyped.id] = {
				input: void 0,
				output: void 0,
				traits: void 0
			};
		}
		this.CodecTypes = codecTypes;
		const dataTypes = {};
		for (const key in this._codecs) if (Object.hasOwn(this._codecs, key)) dataTypes[key] = this._codecs[key].id;
		this.dataTypes = dataTypes;
	}
	add(scalarName, codecImpl) {
		return new CodecDefBuilderImpl({
			...this._codecs,
			[scalarName]: codecImpl
		});
	}
	/**
	* Derive codecDefinitions structure.
	*/
	get codecDefinitions() {
		const result = {};
		for (const [scalarName, codecImpl] of Object.entries(this._codecs)) {
			const codec$1 = codecImpl;
			result[scalarName] = {
				typeId: codec$1.id,
				scalar: scalarName,
				codec: codec$1,
				input: void 0,
				output: void 0,
				jsType: void 0
			};
		}
		return result;
	}
};
/**
* Create a new codec registry.
*/
function createCodecRegistry() {
	return new CodecRegistryImpl();
}
/**
* Create a new codec definition builder.
*/
function defineCodecs() {
	return new CodecDefBuilderImpl({});
}

//#endregion
//#region src/ast/sql-codecs.ts
const SQL_CHAR_CODEC_ID = "sql/char@1";
const SQL_VARCHAR_CODEC_ID = "sql/varchar@1";
const SQL_INT_CODEC_ID = "sql/int@1";
const SQL_FLOAT_CODEC_ID = "sql/float@1";
const SQL_TEXT_CODEC_ID = "sql/text@1";
const SQL_TIMESTAMP_CODEC_ID = "sql/timestamp@1";
const lengthParamsSchema = type({ length: "number.integer > 0" });
const precisionParamsSchema = type({ "precision?": "number.integer >= 0 & number.integer <= 6" });
function createLengthTypeHelper(kind) {
	return (params) => ({
		kind,
		maxLength: params["length"]
	});
}
const sqlCharCodec = codec({
	typeId: SQL_CHAR_CODEC_ID,
	targetTypes: ["char"],
	traits: [
		"equality",
		"order",
		"textual"
	],
	encode: (value) => value,
	decode: (wire) => wire.trimEnd(),
	paramsSchema: lengthParamsSchema,
	init: createLengthTypeHelper("fixed"),
	renderOutputType: (typeParams) => {
		const length = typeParams["length"];
		if (length === void 0) return void 0;
		if (typeof length !== "number" || !Number.isFinite(length) || !Number.isInteger(length)) throw new Error(`renderOutputType: expected integer "length" in typeParams for Char, got ${String(length)}`);
		return `Char<${length}>`;
	}
});
const sqlVarcharCodec = codec({
	typeId: SQL_VARCHAR_CODEC_ID,
	targetTypes: ["varchar"],
	traits: [
		"equality",
		"order",
		"textual"
	],
	encode: (value) => value,
	decode: (wire) => wire,
	paramsSchema: lengthParamsSchema,
	init: createLengthTypeHelper("variable"),
	renderOutputType: (typeParams) => {
		const length = typeParams["length"];
		if (length === void 0) return void 0;
		if (typeof length !== "number" || !Number.isFinite(length) || !Number.isInteger(length)) throw new Error(`renderOutputType: expected integer "length" in typeParams for Varchar, got ${String(length)}`);
		return `Varchar<${length}>`;
	}
});
const sqlIntCodec = codec({
	typeId: SQL_INT_CODEC_ID,
	targetTypes: ["int"],
	traits: [
		"equality",
		"order",
		"numeric"
	],
	encode: (value) => value,
	decode: (wire) => wire
});
const sqlFloatCodec = codec({
	typeId: SQL_FLOAT_CODEC_ID,
	targetTypes: ["float"],
	traits: [
		"equality",
		"order",
		"numeric"
	],
	encode: (value) => value,
	decode: (wire) => wire
});
const sqlTextCodec = codec({
	typeId: SQL_TEXT_CODEC_ID,
	targetTypes: ["text"],
	traits: [
		"equality",
		"order",
		"textual"
	],
	encode: (value) => value,
	decode: (wire) => wire
});
const sqlTimestampCodec = codec({
	typeId: SQL_TIMESTAMP_CODEC_ID,
	targetTypes: ["timestamp"],
	traits: ["equality", "order"],
	encode: (value) => value,
	decode: (wire) => wire,
	encodeJson: (value) => value.toISOString(),
	decodeJson: (json) => {
		if (typeof json !== "string") throw new Error(`Expected ISO date string for sql/timestamp@1, got ${typeof json}`);
		const date = new Date(json);
		if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO date string for sql/timestamp@1: ${json}`);
		return date;
	},
	paramsSchema: precisionParamsSchema,
	renderOutputType: (typeParams) => {
		const precision = typeParams["precision"];
		if (precision === void 0) return "Timestamp";
		if (typeof precision !== "number" || !Number.isFinite(precision) || !Number.isInteger(precision)) throw new Error(`renderOutputType: expected integer "precision" in typeParams for Timestamp, got ${String(precision)}`);
		return `Timestamp<${precision}>`;
	}
});
const codecs = defineCodecs().add("char", sqlCharCodec).add("varchar", sqlVarcharCodec).add("int", sqlIntCodec).add("float", sqlFloatCodec).add("text", sqlTextCodec).add("timestamp", sqlTimestampCodec);
const sqlCodecDefinitions = codecs.codecDefinitions;
const sqlDataTypes = codecs.dataTypes;

//#endregion
//#region src/ast/util.ts
function compact(o) {
	const out = {};
	for (const [k, v] of Object.entries(o)) {
		if (v === void 0 || v === null) continue;
		if (Array.isArray(v) && v.length === 0) continue;
		out[k] = v;
	}
	return out;
}
/**
* Walks an AST's parameter references in first-encounter order and dedupes
* by ParamRef identity. The single canonical helper used by every consumer
* that aligns `plan.params` with metadata-by-index — the SQL builder lane,
* the SQL ORM client, the SQL runtime encoder, and the Postgres renderer's
* `$N` index map — so the four walks cannot drift in dedupe semantics.
*
* SQLite's `?`-placeholder renderer intentionally does NOT use this helper
* because it needs one params entry per occurrence in the SQL.
*/
function collectOrderedParamRefs(ast) {
	const seen = /* @__PURE__ */ new Set();
	const ordered = [];
	for (const ref of ast.collectParamRefs()) {
		if (seen.has(ref)) continue;
		seen.add(ref);
		ordered.push(ref);
	}
	return Object.freeze(ordered);
}

//#endregion
export { AggregateExpr, AndExpr, BinaryExpr, ColumnRef, DefaultValueExpr, DeleteAst, DerivedTableSource, DoNothingConflictAction, DoUpdateSetConflictAction, EqColJoinOn, ExistsExpr, IdentifierRef, InsertAst, InsertOnConflict, JoinAst, JsonArrayAggExpr, JsonObjectExpr, ListExpression, LiteralExpr, NotExpr, NullCheckExpr, OperationExpr, OrExpr, OrderByItem, ParamRef, ProjectionItem, SQL_CHAR_CODEC_ID, SQL_FLOAT_CODEC_ID, SQL_INT_CODEC_ID, SQL_TEXT_CODEC_ID, SQL_TIMESTAMP_CODEC_ID, SQL_VARCHAR_CODEC_ID, SelectAst, SubqueryExpr, TableSource, UpdateAst, codec, collectOrderedParamRefs, compact, createCodecRegistry, defineCodecs, isQueryAst, isWhereExpr, queryAstKinds, sqlCodecDefinitions, sqlDataTypes, whereExprKinds };
//# sourceMappingURL=ast.mjs.map