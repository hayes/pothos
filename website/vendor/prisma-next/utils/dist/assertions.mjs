//#region src/assertions.ts
/**
* Asserts that a value is defined (not null or undefined).
* Use for invariants where the value should always exist at runtime.
*
* @throws Error if value is null or undefined
*
* @example
* ```typescript
* const table = storage.tables[tableName];
* assertDefined(table, `Table "${tableName}" not found`);
* // table is now narrowed to non-nullable
* ```
*/
function assertDefined(value, message) {
	if (value === null || value === void 0) throw new Error(message);
}
/**
* Asserts that a condition is true.
* Use for invariants that should always hold at runtime.
*
* @throws Error if condition is false
*
* @example
* ```typescript
* invariant(columns.length > 0, 'Primary key must have at least one column');
* ```
*/
function invariant(condition, message) {
	if (!condition) throw new Error(message);
}

//#endregion
export { assertDefined, invariant };
//# sourceMappingURL=assertions.mjs.map