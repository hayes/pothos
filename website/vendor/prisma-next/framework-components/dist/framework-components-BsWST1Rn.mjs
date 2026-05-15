//#region src/shared/framework-components.ts
function checkContractComponentRequirements(input) {
	const providedIds = /* @__PURE__ */ new Set();
	for (const id of input.providedComponentIds) providedIds.add(id);
	const missingExtensionPackIds = (input.contract.extensionPacks ? Object.keys(input.contract.extensionPacks) : []).filter((id) => !providedIds.has(id));
	const expectedTargetFamily = input.expectedTargetFamily;
	const contractTargetFamily = input.contract.targetFamily;
	const familyMismatch = expectedTargetFamily !== void 0 && contractTargetFamily !== void 0 && contractTargetFamily !== expectedTargetFamily ? {
		expected: expectedTargetFamily,
		actual: contractTargetFamily
	} : void 0;
	const expectedTargetId = input.expectedTargetId;
	const contractTargetId = input.contract.target;
	const targetMismatch = expectedTargetId !== void 0 && contractTargetId !== expectedTargetId ? {
		expected: expectedTargetId,
		actual: contractTargetId
	} : void 0;
	return {
		...familyMismatch ? { familyMismatch } : {},
		...targetMismatch ? { targetMismatch } : {},
		missingExtensionPackIds
	};
}

//#endregion
export { checkContractComponentRequirements as t };
//# sourceMappingURL=framework-components-BsWST1Rn.mjs.map