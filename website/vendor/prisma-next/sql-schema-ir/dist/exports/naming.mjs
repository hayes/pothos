//#region src/exports/naming.ts
function defaultIndexName(tableName, columns) {
	return `${tableName}_${columns.join("_")}_idx`;
}

//#endregion
export { defaultIndexName };
//# sourceMappingURL=naming.mjs.map