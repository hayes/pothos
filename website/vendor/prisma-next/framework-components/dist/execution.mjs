import { t as checkContractComponentRequirements } from "./framework-components-BsWST1Rn.mjs";

//#region src/execution/execution-requirements.ts
function assertRuntimeContractRequirementsSatisfied({ contract, family, target, adapter, extensionPacks }) {
	const providedComponentIds = new Set([
		family.id,
		target.id,
		adapter.id
	]);
	for (const extension of extensionPacks) providedComponentIds.add(extension.id);
	const result = checkContractComponentRequirements({
		contract,
		expectedTargetId: target.targetId,
		providedComponentIds
	});
	if (result.targetMismatch) throw new Error(`Contract target '${result.targetMismatch.actual}' does not match runtime target descriptor '${result.targetMismatch.expected}'.`);
	for (const packId of result.missingExtensionPackIds) throw new Error(`Contract requires extension pack '${packId}', but runtime descriptors do not provide a matching component.`);
}

//#endregion
//#region src/execution/execution-stack.ts
function createExecutionStack(input) {
	return {
		target: input.target,
		adapter: input.adapter,
		driver: input.driver,
		extensionPacks: input.extensionPacks ?? []
	};
}
function instantiateExecutionStack(stack) {
	const driver = stack.driver ? stack.driver.create() : void 0;
	return {
		stack,
		target: stack.target.create(),
		adapter: stack.adapter.create(stack),
		driver,
		extensionPacks: stack.extensionPacks.map((descriptor) => descriptor.create())
	};
}

//#endregion
export { assertRuntimeContractRequirementsSatisfied, createExecutionStack, instantiateExecutionStack };
//# sourceMappingURL=execution.mjs.map