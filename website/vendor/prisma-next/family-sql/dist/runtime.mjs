//#region src/core/runtime-instance.ts
/**
* Creates a SQL execution-plane family instance.
*
* This will be renamed to `createSqlExecutionFamilyInstance()` as part of `TML-1842`.
*/
function createSqlRuntimeFamilyInstance() {
	return { familyId: "sql" };
}

//#endregion
//#region src/core/runtime-descriptor.ts
/**
* SQL execution-plane family descriptor.
*
* Note: this is currently named `sqlRuntimeFamilyDescriptor` because the execution plane
* framework types are still using the `Runtime*` naming (`RuntimeFamilyDescriptor`, etc.).
*
* This will be renamed to `sqlExecutionFamilyDescriptor` as part of `TML-1842`.
*/
const sqlRuntimeFamilyDescriptor = {
	kind: "family",
	id: "sql",
	familyId: "sql",
	version: "0.0.1",
	create() {
		return createSqlRuntimeFamilyInstance();
	}
};
Object.freeze(sqlRuntimeFamilyDescriptor);

//#endregion
//#region src/exports/runtime.ts
var runtime_default = sqlRuntimeFamilyDescriptor;

//#endregion
export { runtime_default as default };
//# sourceMappingURL=runtime.mjs.map