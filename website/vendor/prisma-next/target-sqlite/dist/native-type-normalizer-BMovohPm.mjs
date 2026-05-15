//#region src/core/native-type-normalizer.ts
/**
* Canonicalizes SQLite native-type tokens for verifier comparison.
* Lives target-side so the planner / runner / adapter all share the same
* normalization without crossing the `target-sqlite` ↔ `adapter-sqlite`
* boundary.
*/
function normalizeSqliteNativeType(nativeType) {
	return nativeType.trim().toLowerCase();
}

//#endregion
export { normalizeSqliteNativeType as t };
//# sourceMappingURL=native-type-normalizer-BMovohPm.mjs.map