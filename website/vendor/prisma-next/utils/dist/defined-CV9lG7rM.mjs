//#region src/defined.ts
/**
* Returns an object with the key/value if value is defined, otherwise an empty object.
*
* Use with spread to conditionally include optional properties while satisfying
* exactOptionalPropertyTypes. This is explicit about which properties are optional
* and won't inadvertently strip other undefined values.
*
* @example
* ```typescript
* // Instead of:
* const obj = {
*   required: 'value',
*   ...(optional ? { optional } : {}),
* };
*
* // Use:
* const obj = {
*   required: 'value',
*   ...ifDefined('optional', optional),
* };
* ```
*/
function ifDefined(key, value) {
	return value !== void 0 ? { [key]: value } : {};
}

//#endregion
export { ifDefined as t };
//# sourceMappingURL=defined-CV9lG7rM.mjs.map