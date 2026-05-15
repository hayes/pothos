//#region src/array-equal.d.ts
/**
 * Checks if two arrays are equal using Object.is() for element comparison.
 * Arrays are considered equal if they have the same length and each element
 * at corresponding indices is equal according to Object.is().
 *
 * @param a - First array to compare
 * @param b - Second array to compare
 * @returns true if arrays are equal, false otherwise
 *
 * @example
 * ```typescript
 * isArrayEqual(['a', 'b'], ['a', 'b']); // true
 * isArrayEqual(['a'], ['a', 'b']); // false
 * isArrayEqual([0], [-0]); // false (Object.is distinguishes +0 and -0)
 * ```
 */
declare function isArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean;
//#endregion
export { isArrayEqual };
//# sourceMappingURL=array-equal.d.mts.map