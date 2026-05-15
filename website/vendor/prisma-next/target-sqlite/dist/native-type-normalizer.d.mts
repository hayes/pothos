//#region src/core/native-type-normalizer.d.ts
/**
 * Canonicalizes SQLite native-type tokens for verifier comparison.
 * Lives target-side so the planner / runner / adapter all share the same
 * normalization without crossing the `target-sqlite` ↔ `adapter-sqlite`
 * boundary.
 */
declare function normalizeSqliteNativeType(nativeType: string): string;
//#endregion
export { normalizeSqliteNativeType };
//# sourceMappingURL=native-type-normalizer.d.mts.map