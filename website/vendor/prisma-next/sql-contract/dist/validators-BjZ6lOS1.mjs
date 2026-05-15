import { ContractValidationError } from "@prisma-next/contract/validate-contract";
import { type } from "arktype";

//#region src/validators.ts
const literalKindSchema = type("'literal'");
const functionKindSchema = type("'function'");
const generatorKindSchema = type("'generator'");
const generatorIdSchema = type("string").narrow((value, ctx) => {
	return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) ? true : ctx.mustBe("a flat generator id");
});
const ColumnDefaultLiteralSchema = type.declare().type({
	kind: literalKindSchema,
	value: "string | number | boolean | null | unknown[] | Record<string, unknown>"
});
const ColumnDefaultFunctionSchema = type.declare().type({
	kind: functionKindSchema,
	expression: "string"
});
const ColumnDefaultSchema = ColumnDefaultLiteralSchema.or(ColumnDefaultFunctionSchema);
const ExecutionMutationDefaultValueSchema = type({
	"+": "reject",
	kind: generatorKindSchema,
	id: generatorIdSchema,
	"params?": "Record<string, unknown>"
});
const ExecutionMutationDefaultSchema = type({
	"+": "reject",
	ref: {
		"+": "reject",
		table: "string",
		column: "string"
	},
	"onCreate?": ExecutionMutationDefaultValueSchema,
	"onUpdate?": ExecutionMutationDefaultValueSchema
});
const ExecutionSchema = type({
	"+": "reject",
	executionHash: "string",
	mutations: {
		"+": "reject",
		defaults: ExecutionMutationDefaultSchema.array().readonly()
	}
});
const StorageColumnSchema = type({
	"+": "reject",
	nativeType: "string",
	codecId: "string",
	nullable: "boolean",
	"typeParams?": "Record<string, unknown>",
	"typeRef?": "string",
	"default?": ColumnDefaultSchema
}).narrow((col, ctx) => {
	if (col.typeParams !== void 0 && col.typeRef !== void 0) return ctx.mustBe("a column with either typeParams or typeRef, not both");
	return true;
});
const StorageTypeInstanceSchema = type.declare().type({
	codecId: "string",
	nativeType: "string",
	typeParams: "Record<string, unknown>"
});
const PrimaryKeySchema = type.declare().type({
	columns: type.string.array().readonly(),
	"name?": "string"
});
const UniqueConstraintSchema = type.declare().type({
	columns: type.string.array().readonly(),
	"name?": "string"
});
const IndexSchema = type({
	columns: type.string.array().readonly(),
	"name?": "string",
	"using?": "string",
	"config?": "Record<string, unknown>"
});
const ForeignKeyReferencesSchema = type.declare().type({
	table: "string",
	columns: type.string.array().readonly()
});
const ReferentialActionSchema = type.declare().type("'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault'");
const ForeignKeySchema = type.declare().type({
	columns: type.string.array().readonly(),
	references: ForeignKeyReferencesSchema,
	"name?": "string",
	"onDelete?": ReferentialActionSchema,
	"onUpdate?": ReferentialActionSchema,
	constraint: "boolean",
	index: "boolean"
});
const StorageTableSchema = type({
	"+": "reject",
	columns: type({ "[string]": StorageColumnSchema }),
	"primaryKey?": PrimaryKeySchema,
	uniques: UniqueConstraintSchema.array().readonly(),
	indexes: IndexSchema.array().readonly(),
	foreignKeys: ForeignKeySchema.array().readonly()
});
const StorageSchema = type({
	"+": "reject",
	storageHash: "string",
	tables: type({ "[string]": StorageTableSchema }),
	"types?": type({ "[string]": StorageTypeInstanceSchema })
});
function isPlainRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isContractFieldType(value) {
	if (!isPlainRecord(value)) return false;
	const kind = value["kind"];
	if (kind === "scalar") {
		if (typeof value["codecId"] !== "string") return false;
		const typeParams = value["typeParams"];
		if (typeParams !== void 0 && !isPlainRecord(typeParams)) return false;
		return true;
	}
	if (kind === "valueObject") return typeof value["name"] === "string";
	if (kind === "union") {
		const members = value["members"];
		if (!Array.isArray(members)) return false;
		return members.every((m) => isContractFieldType(m));
	}
	return false;
}
const ContractFieldTypeSchema = type("unknown").narrow((value, ctx) => isContractFieldType(value) ? true : ctx.mustBe("scalar, valueObject, or union field type"));
const ModelFieldSchema = type({
	"+": "reject",
	nullable: "boolean",
	type: ContractFieldTypeSchema,
	"many?": "true",
	"dict?": "true"
});
const ModelStorageFieldSchema = type({
	column: "string",
	"codecId?": "string",
	"nullable?": "boolean"
});
const ModelSchema = type({
	storage: type({
		table: "string",
		fields: type({ "[string]": ModelStorageFieldSchema })
	}),
	"fields?": type({ "[string]": ModelFieldSchema }),
	"relations?": type({ "[string]": "unknown" }),
	"discriminator?": "unknown",
	"variants?": "unknown",
	"base?": "string",
	"owner?": "string"
});
const ContractMetaSchema = type({ "[string]": "unknown" });
const SqlContractSchema = type({
	"+": "reject",
	target: "string",
	targetFamily: "'sql'",
	"coreHash?": "string",
	profileHash: "string",
	"capabilities?": "Record<string, Record<string, boolean>>",
	"extensionPacks?": "Record<string, unknown>",
	"meta?": ContractMetaSchema,
	"roots?": "Record<string, string>",
	models: type({ "[string]": ModelSchema }),
	"valueObjects?": "Record<string, unknown>",
	storage: StorageSchema,
	"execution?": ExecutionSchema
});
/**
* Validates the structural shape of SqlStorage using Arktype.
*
* @param value - The storage value to validate
* @returns The validated storage if structure is valid
* @throws Error if the storage structure is invalid
*/
function validateStorage(value) {
	const result = StorageSchema(value);
	if (result instanceof type.errors) {
		const messages = result.map((p) => p.message).join("; ");
		throw new Error(`Storage validation failed: ${messages}`);
	}
	return result;
}
function validateModel(value) {
	const result = ModelSchema(value);
	if (result instanceof type.errors) {
		const messages = result.map((p) => p.message).join("; ");
		throw new Error(`Model validation failed: ${messages}`);
	}
	return result;
}
/**
* Validates the structural shape of an SQL contract using Arktype.
*
* Ensures all required fields are present and have the correct types,
* including SQL-specific storage structure (tables, columns, constraints).
*
* @param value - The contract value to validate (typically from a JSON import)
* @returns The validated contract if structure is valid
* @throws ContractValidationError if the contract structure is invalid
*/
function validateSqlContract(value) {
	if (typeof value !== "object" || value === null) throw new ContractValidationError("Contract structural validation failed: value must be an object", "structural");
	const rawValue = value;
	if (rawValue.targetFamily !== void 0 && rawValue.targetFamily !== "sql") throw new ContractValidationError(`Unsupported target family: ${rawValue.targetFamily}`, "structural");
	const contractResult = SqlContractSchema(value);
	if (contractResult instanceof type.errors) throw new ContractValidationError(`Contract structural validation failed: ${contractResult.map((p) => p.message).join("; ")}`, "structural");
	return contractResult;
}
/**
* Validates semantic constraints on SqlStorage that cannot be expressed in Arktype schemas.
*
* Returns an array of human-readable error strings. Empty array = valid.
*
* Currently checks:
* - duplicate named primary key / unique / index / foreign key objects within a table
* - duplicate unique, index, or foreign key declarations within a table
* - `setNull` referential action on a non-nullable FK column (would fail at runtime)
* - `setDefault` referential action on a non-nullable FK column without a DEFAULT (would fail at runtime)
*/
function validateStorageSemantics(storage) {
	const errors = [];
	for (const [tableName, table] of Object.entries(storage.tables)) {
		const namedObjects = /* @__PURE__ */ new Map();
		const registerNamedObject = (kind, name) => {
			if (!name) return;
			namedObjects.set(name, [...namedObjects.get(name) ?? [], kind]);
		};
		registerNamedObject("primary key", table.primaryKey?.name);
		for (const unique of table.uniques) registerNamedObject("unique constraint", unique.name);
		for (const index of table.indexes) registerNamedObject("index", index.name);
		for (const fk of table.foreignKeys) registerNamedObject("foreign key", fk.name);
		for (const [name, kinds] of namedObjects) if (kinds.length > 1) errors.push(`Table "${tableName}": named object "${name}" is declared multiple times (${kinds.join(", ")})`);
		const seenUniqueDefinitions = /* @__PURE__ */ new Set();
		for (const unique of table.uniques) {
			const signature = JSON.stringify({ columns: unique.columns });
			if (seenUniqueDefinitions.has(signature)) {
				errors.push(`Table "${tableName}": duplicate unique constraint definition on columns [${unique.columns.join(", ")}]`);
				continue;
			}
			seenUniqueDefinitions.add(signature);
		}
		const seenIndexDefinitions = /* @__PURE__ */ new Set();
		for (const index of table.indexes) {
			const signature = JSON.stringify({
				columns: index.columns,
				using: index.using ?? null,
				config: index.config ?? null
			});
			if (seenIndexDefinitions.has(signature)) {
				errors.push(`Table "${tableName}": duplicate index definition on columns [${index.columns.join(", ")}]`);
				continue;
			}
			seenIndexDefinitions.add(signature);
		}
		const seenForeignKeyDefinitions = /* @__PURE__ */ new Set();
		for (const fk of table.foreignKeys) {
			const signature = JSON.stringify({
				columns: fk.columns,
				references: fk.references,
				onDelete: fk.onDelete ?? null,
				onUpdate: fk.onUpdate ?? null,
				constraint: fk.constraint,
				index: fk.index
			});
			if (seenForeignKeyDefinitions.has(signature)) {
				errors.push(`Table "${tableName}": duplicate foreign key definition on columns [${fk.columns.join(", ")}]`);
				continue;
			}
			seenForeignKeyDefinitions.add(signature);
		}
		for (const fk of table.foreignKeys) for (const colName of fk.columns) {
			const column = table.columns[colName];
			if (!column) continue;
			if (fk.onDelete === "setNull" && !column.nullable) errors.push(`Table "${tableName}": onDelete setNull on foreign key column "${colName}" which is NOT NULL`);
			if (fk.onUpdate === "setNull" && !column.nullable) errors.push(`Table "${tableName}": onUpdate setNull on foreign key column "${colName}" which is NOT NULL`);
			if (fk.onDelete === "setDefault" && !column.nullable && column.default === void 0) errors.push(`Table "${tableName}": onDelete setDefault on foreign key column "${colName}" which is NOT NULL and has no DEFAULT`);
			if (fk.onUpdate === "setDefault" && !column.nullable && column.default === void 0) errors.push(`Table "${tableName}": onUpdate setDefault on foreign key column "${colName}" which is NOT NULL and has no DEFAULT`);
		}
	}
	return errors;
}

//#endregion
export { ForeignKeySchema as a, validateModel as c, validateStorageSemantics as d, ForeignKeyReferencesSchema as i, validateSqlContract as l, ColumnDefaultLiteralSchema as n, IndexSchema as o, ColumnDefaultSchema as r, ReferentialActionSchema as s, ColumnDefaultFunctionSchema as t, validateStorage as u };
//# sourceMappingURL=validators-BjZ6lOS1.mjs.map