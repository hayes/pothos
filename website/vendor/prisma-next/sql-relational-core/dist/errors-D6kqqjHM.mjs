//#region src/errors.ts
function planInvalid(message, details, hints, docs) {
	const error = new Error(message);
	Object.defineProperty(error, "name", {
		value: "RuntimeError",
		configurable: true
	});
	return Object.assign(error, {
		code: "PLAN.INVALID",
		category: "PLAN",
		severity: "error",
		details,
		hints,
		docs
	});
}
function planUnsupported(message, details, hints, docs) {
	const error = new Error(message);
	Object.defineProperty(error, "name", {
		value: "RuntimeError",
		configurable: true
	});
	return Object.assign(error, {
		code: "PLAN.UNSUPPORTED",
		category: "PLAN",
		severity: "error",
		details,
		hints,
		docs
	});
}

//#endregion
export { planUnsupported as n, planInvalid as t };
//# sourceMappingURL=errors-D6kqqjHM.mjs.map