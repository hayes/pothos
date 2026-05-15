import { isArrayEqual } from "@prisma-next/utils/array-equal";
import { ifDefined } from "@prisma-next/utils/defined";
import { createHash } from "node:crypto";

//#region src/canonicalization.ts
const TOP_LEVEL_ORDER = [
	"schemaVersion",
	"canonicalVersion",
	"targetFamily",
	"target",
	"profileHash",
	"roots",
	"models",
	"valueObjects",
	"storage",
	"execution",
	"capabilities",
	"extensionPacks",
	"meta"
];
function isDefaultValue(value) {
	if (value === false) return true;
	if (value === null) return false;
	if (Array.isArray(value) && value.length === 0) return true;
	if (typeof value === "object" && value !== null) return Object.keys(value).length === 0;
	return false;
}
function omitDefaults(obj, path) {
	if (obj === null || typeof obj !== "object") return obj;
	if (Array.isArray(obj)) return obj.map((item) => omitDefaults(item, path));
	const result = {};
	for (const [key, value] of Object.entries(obj)) {
		const currentPath = [...path, key];
		if (key === "_generated") continue;
		if (key === "generated" && value === false) continue;
		if ((key === "onDelete" || key === "onUpdate") && value === "noAction") continue;
		if (isDefaultValue(value)) {
			const isRequiredModels = isArrayEqual(currentPath, ["models"]);
			const isRequiredTables = isArrayEqual(currentPath, ["storage", "tables"]);
			const isRequiredCollections = isArrayEqual(currentPath, ["storage", "collections"]);
			const isCollectionEntry = currentPath.length === 3 && isArrayEqual([currentPath[0], currentPath[1]], ["storage", "collections"]);
			const isRequiredRoots = isArrayEqual(currentPath, ["roots"]);
			const isRequiredExtensionPacks = isArrayEqual(currentPath, ["extensionPacks"]);
			const isRequiredCapabilities = isArrayEqual(currentPath, ["capabilities"]);
			const isRequiredMeta = isArrayEqual(currentPath, ["meta"]);
			const isRequiredExecutionDefaults = isArrayEqual(currentPath, [
				"execution",
				"mutations",
				"defaults"
			]);
			const isExtensionNamespace = currentPath.length === 2 && currentPath[0] === "extensionPacks";
			const isModelRelations = currentPath.length === 3 && isArrayEqual([currentPath[0], currentPath[2]], ["models", "relations"]);
			const isModelStorage = currentPath.length === 3 && isArrayEqual([currentPath[0], currentPath[2]], ["models", "storage"]);
			const isTableUniques = currentPath.length === 4 && isArrayEqual([
				currentPath[0],
				currentPath[1],
				currentPath[3]
			], [
				"storage",
				"tables",
				"uniques"
			]);
			const isTableIndexes = currentPath.length === 4 && isArrayEqual([
				currentPath[0],
				currentPath[1],
				currentPath[3]
			], [
				"storage",
				"tables",
				"indexes"
			]);
			const isTableForeignKeys = currentPath.length === 4 && isArrayEqual([
				currentPath[0],
				currentPath[1],
				currentPath[3]
			], [
				"storage",
				"tables",
				"foreignKeys"
			]);
			const isFkBooleanField = currentPath.length === 5 && currentPath[0] === "storage" && currentPath[1] === "tables" && currentPath[3] === "foreignKeys" && (key === "constraint" || key === "index");
			if (!isRequiredModels && !isRequiredTables && !isRequiredCollections && !isCollectionEntry && !isRequiredRoots && !isRequiredExtensionPacks && !isRequiredCapabilities && !isRequiredMeta && !isRequiredExecutionDefaults && !isExtensionNamespace && !isModelRelations && !isModelStorage && !isTableUniques && !isTableIndexes && !isTableForeignKeys && !isFkBooleanField && !(key === "nullable")) continue;
		}
		result[key] = omitDefaults(value, currentPath);
	}
	return result;
}
function sortObjectKeys(obj) {
	if (obj === null || typeof obj !== "object") return obj;
	if (Array.isArray(obj)) return obj.map((item) => sortObjectKeys(item));
	const sorted = {};
	const keys = Object.keys(obj).sort();
	for (const key of keys) sorted[key] = sortObjectKeys(obj[key]);
	return sorted;
}
function sortIndexesAndUniques(storage) {
	if (!storage || typeof storage !== "object") return storage;
	const storageObj = storage;
	if (!storageObj.tables || typeof storageObj.tables !== "object") return storage;
	const tables = storageObj.tables;
	const result = { ...storageObj };
	result.tables = {};
	const sortedTableNames = Object.keys(tables).sort();
	for (const tableName of sortedTableNames) {
		const table = tables[tableName];
		if (!table || typeof table !== "object") {
			result.tables[tableName] = table;
			continue;
		}
		const tableObj = table;
		const sortedTable = { ...tableObj };
		if (Array.isArray(tableObj.indexes)) sortedTable.indexes = [...tableObj.indexes].sort((a, b) => {
			const nameA = a?.name || "";
			const nameB = b?.name || "";
			return nameA.localeCompare(nameB);
		});
		if (Array.isArray(tableObj.uniques)) sortedTable.uniques = [...tableObj.uniques].sort((a, b) => {
			const nameA = a?.name || "";
			const nameB = b?.name || "";
			return nameA.localeCompare(nameB);
		});
		result.tables[tableName] = sortedTable;
	}
	return result;
}
function orderTopLevel(obj) {
	const ordered = {};
	const remaining = new Set(Object.keys(obj));
	for (const key of TOP_LEVEL_ORDER) if (remaining.has(key)) {
		ordered[key] = obj[key];
		remaining.delete(key);
	}
	for (const key of Array.from(remaining).sort()) ordered[key] = obj[key];
	return ordered;
}
function canonicalizeContractToObject(contract, options) {
	const withDefaultsOmitted = omitDefaults({
		...ifDefined("schemaVersion", options?.schemaVersion),
		targetFamily: contract.targetFamily,
		target: contract.target,
		profileHash: contract.profileHash,
		roots: contract.roots,
		models: contract.models,
		...ifDefined("valueObjects", contract.valueObjects),
		storage: contract.storage,
		...ifDefined("execution", contract.execution),
		extensionPacks: contract.extensionPacks,
		capabilities: contract.capabilities,
		meta: contract.meta
	}, []);
	const withSortedIndexes = sortIndexesAndUniques(withDefaultsOmitted["storage"]);
	return orderTopLevel(sortObjectKeys({
		...withDefaultsOmitted,
		storage: withSortedIndexes
	}));
}
function canonicalizeContract(contract, options) {
	return JSON.stringify(canonicalizeContractToObject(contract, options), null, 2);
}

//#endregion
//#region src/hashing.ts
const SCHEMA_VERSION = "1";
function sha256(content) {
	const hash = createHash("sha256");
	hash.update(content);
	return `sha256:${hash.digest("hex")}`;
}
function hashContract(section) {
	return canonicalizeContract({
		targetFamily: section["targetFamily"],
		target: section["target"],
		roots: {},
		models: {},
		storage: section["storage"] ?? {},
		execution: section["execution"],
		extensionPacks: {},
		capabilities: section["capabilities"] ?? {},
		meta: {},
		profileHash: "",
		...section
	}, { schemaVersion: SCHEMA_VERSION });
}
function computeStorageHash(args) {
	return sha256(hashContract(args));
}
function computeExecutionHash(args) {
	return sha256(hashContract(args));
}
function computeProfileHash(args) {
	return sha256(hashContract(args));
}

//#endregion
export { canonicalizeContractToObject as a, canonicalizeContract as i, computeProfileHash as n, computeStorageHash as r, computeExecutionHash as t };
//# sourceMappingURL=hashing-CyaA_Qvf.mjs.map