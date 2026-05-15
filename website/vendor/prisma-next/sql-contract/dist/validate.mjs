import { d as validateStorageSemantics, l as validateSqlContract } from "./validators-BjZ6lOS1.mjs";
import { ContractValidationError, validateContract as validateContract$1 } from "@prisma-next/contract/validate-contract";

//#region src/validate.ts
function validateModelStorageReferences(contract) {
	for (const [modelName, model] of Object.entries(contract.models)) {
		const storageTable = model.storage.table;
		const table = contract.storage.tables[storageTable];
		if (!table) throw new ContractValidationError(`Model "${modelName}" references non-existent table "${storageTable}"`, "storage");
		const columnNames = new Set(Object.keys(table.columns));
		for (const [fieldName, field] of Object.entries(model.storage.fields)) if (!columnNames.has(field.column)) throw new ContractValidationError(`Model "${modelName}" field "${fieldName}" references non-existent column "${field.column}" in table "${storageTable}"`, "storage");
		const JSON_NATIVE_TYPES = new Set(["json", "jsonb"]);
		for (const [fieldName, domainField] of Object.entries(model.fields)) {
			if (domainField.type?.kind !== "valueObject") continue;
			const storageField = model.storage.fields[fieldName];
			if (!storageField) continue;
			const column = table.columns[storageField.column];
			if (!column) continue;
			if (!JSON_NATIVE_TYPES.has(column.nativeType)) throw new ContractValidationError(`Model "${modelName}" field "${fieldName}" is a value object but storage column "${storageField.column}" has nativeType "${column.nativeType}" (expected json or jsonb)`, "storage");
		}
	}
}
function validateContractLogic(contract) {
	const tableNames = new Set(Object.keys(contract.storage.tables));
	for (const [tableName, table] of Object.entries(contract.storage.tables)) {
		const columnNames = new Set(Object.keys(table.columns));
		if (table.primaryKey) {
			for (const colName of table.primaryKey.columns) if (!columnNames.has(colName)) throw new ContractValidationError(`Table "${tableName}" primaryKey references non-existent column "${colName}"`, "storage");
		}
		for (const unique of table.uniques) for (const colName of unique.columns) if (!columnNames.has(colName)) throw new ContractValidationError(`Table "${tableName}" unique constraint references non-existent column "${colName}"`, "storage");
		for (const index of table.indexes) for (const colName of index.columns) if (!columnNames.has(colName)) throw new ContractValidationError(`Table "${tableName}" index references non-existent column "${colName}"`, "storage");
		for (const [colName, column] of Object.entries(table.columns)) if (!column.nullable && column.default?.kind === "literal" && column.default.value === null) throw new ContractValidationError(`Table "${tableName}" column "${colName}" is NOT NULL but has a literal null default`, "storage");
		for (const fk of table.foreignKeys) {
			for (const colName of fk.columns) if (!columnNames.has(colName)) throw new ContractValidationError(`Table "${tableName}" foreignKey references non-existent column "${colName}"`, "storage");
			if (!tableNames.has(fk.references.table)) throw new ContractValidationError(`Table "${tableName}" foreignKey references non-existent table "${fk.references.table}"`, "storage");
			const referencedTable = contract.storage.tables[fk.references.table];
			if (!referencedTable) continue;
			const referencedColumnNames = new Set(Object.keys(referencedTable.columns));
			for (const colName of fk.references.columns) if (!referencedColumnNames.has(colName)) throw new ContractValidationError(`Table "${tableName}" foreignKey references non-existent column "${colName}" in table "${fk.references.table}"`, "storage");
			if (fk.columns.length !== fk.references.columns.length) throw new ContractValidationError(`Table "${tableName}" foreignKey column count (${fk.columns.length}) does not match referenced column count (${fk.references.columns.length})`, "storage");
		}
	}
}
function validateSqlStorage(contract) {
	const sqlContract = validateSqlContract(contract);
	validateContractLogic(sqlContract);
	validateModelStorageReferences(sqlContract);
	const semanticErrors = validateStorageSemantics(sqlContract.storage);
	if (semanticErrors.length > 0) throw new ContractValidationError(`Contract semantic validation failed: ${semanticErrors.join("; ")}`, "storage");
}
function decodeContractDefaults(contract, codecLookup) {
	const tables = contract.storage.tables;
	let tablesChanged = false;
	const decodedTables = {};
	for (const [tableName, table] of Object.entries(tables)) {
		let columnsChanged = false;
		const decodedColumns = {};
		for (const [columnName, column] of Object.entries(table.columns)) {
			if (column.default?.kind === "literal") {
				const codec = codecLookup.get(column.codecId);
				if (codec) {
					const decodedValue = codec.decodeJson(column.default.value);
					if (decodedValue !== column.default.value) {
						columnsChanged = true;
						decodedColumns[columnName] = {
							...column,
							default: {
								kind: "literal",
								value: decodedValue
							}
						};
						continue;
					}
				}
			}
			decodedColumns[columnName] = column;
		}
		if (columnsChanged) {
			tablesChanged = true;
			decodedTables[tableName] = {
				...table,
				columns: decodedColumns
			};
		} else decodedTables[tableName] = table;
	}
	if (!tablesChanged) return contract;
	return {
		...contract,
		storage: {
			...contract.storage,
			tables: decodedTables
		}
	};
}
function validateContract(value, codecLookup) {
	const validated = validateContract$1(value, validateSqlStorage);
	try {
		return decodeContractDefaults(validated, codecLookup);
	} catch (error) {
		if (error instanceof ContractValidationError) throw error;
		throw new ContractValidationError(error instanceof Error ? error.message : String(error), "storage");
	}
}

//#endregion
export { validateContract };
//# sourceMappingURL=validate.mjs.map