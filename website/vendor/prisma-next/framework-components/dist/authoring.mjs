import { ifDefined } from "@prisma-next/utils/defined";

//#region src/shared/framework-authoring.ts
function isAuthoringArgRef(value) {
	if (typeof value !== "object" || value === null || value.kind !== "arg") return false;
	const { index, path } = value;
	if (typeof index !== "number" || !Number.isInteger(index) || index < 0) return false;
	if (path !== void 0 && (!Array.isArray(path) || path.some((s) => typeof s !== "string"))) return false;
	return true;
}
function isAuthoringTemplateRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAuthoringTypeConstructorDescriptor(value) {
	return typeof value === "object" && value !== null && value.kind === "typeConstructor" && typeof value.output === "object" && value.output !== null;
}
function isAuthoringFieldPresetDescriptor(value) {
	return typeof value === "object" && value !== null && value.kind === "fieldPreset" && typeof value.output === "object" && value.output !== null;
}
function resolveAuthoringTemplateValue(template, args) {
	if (isAuthoringArgRef(template)) {
		let value = args[template.index];
		for (const segment of template.path ?? []) {
			if (!isAuthoringTemplateRecord(value) || !Object.hasOwn(value, segment)) {
				value = void 0;
				break;
			}
			value = value[segment];
		}
		if (value === void 0 && template.default !== void 0) return resolveAuthoringTemplateValue(template.default, args);
		return value;
	}
	if (Array.isArray(template)) return template.map((value) => resolveAuthoringTemplateValue(value, args));
	if (typeof template === "object" && template !== null) {
		const resolved = {};
		for (const [key, value] of Object.entries(template)) {
			const resolvedValue = resolveAuthoringTemplateValue(value, args);
			if (resolvedValue !== void 0) resolved[key] = resolvedValue;
		}
		return resolved;
	}
	return template;
}
function validateAuthoringArgument(descriptor, value, path) {
	if (value === void 0) {
		if (descriptor.optional) return;
		throw new Error(`Missing required authoring helper argument at ${path}`);
	}
	if (descriptor.kind === "string") {
		if (typeof value !== "string") throw new Error(`Authoring helper argument at ${path} must be a string`);
		return;
	}
	if (descriptor.kind === "stringArray") {
		if (!Array.isArray(value)) throw new Error(`Authoring helper argument at ${path} must be an array of strings`);
		for (const entry of value) if (typeof entry !== "string") throw new Error(`Authoring helper argument at ${path} must be an array of strings`);
		return;
	}
	if (descriptor.kind === "object") {
		if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Authoring helper argument at ${path} must be an object`);
		const input = value;
		const expectedKeys = new Set(Object.keys(descriptor.properties));
		for (const key of Object.keys(input)) if (!expectedKeys.has(key)) throw new Error(`Authoring helper argument at ${path} contains unknown property "${key}"`);
		for (const [key, propertyDescriptor] of Object.entries(descriptor.properties)) validateAuthoringArgument(propertyDescriptor, input[key], `${path}.${key}`);
		return;
	}
	if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`Authoring helper argument at ${path} must be a number`);
	if (descriptor.integer && !Number.isInteger(value)) throw new Error(`Authoring helper argument at ${path} must be an integer`);
	if (descriptor.minimum !== void 0 && value < descriptor.minimum) throw new Error(`Authoring helper argument at ${path} must be >= ${descriptor.minimum}, received ${value}`);
	if (descriptor.maximum !== void 0 && value > descriptor.maximum) throw new Error(`Authoring helper argument at ${path} must be <= ${descriptor.maximum}, received ${value}`);
}
function validateAuthoringHelperArguments(helperPath, descriptors, args) {
	const expected = descriptors ?? [];
	const minimumArgs = expected.reduce((count, descriptor, index) => descriptor.optional ? count : index + 1, 0);
	if (args.length < minimumArgs || args.length > expected.length) throw new Error(`${helperPath} expects ${minimumArgs === expected.length ? expected.length : `${minimumArgs}-${expected.length}`} argument(s), received ${args.length}`);
	expected.forEach((descriptor, index) => {
		validateAuthoringArgument(descriptor, args[index], `${helperPath}[${index}]`);
	});
}
function resolveAuthoringStorageTypeTemplate(template, args) {
	const nativeType = resolveAuthoringTemplateValue(template.nativeType, args);
	if (typeof nativeType !== "string") throw new Error(`Resolved authoring nativeType must be a string for codec "${template.codecId}", received ${String(nativeType)}`);
	const typeParams = template.typeParams === void 0 ? void 0 : resolveAuthoringTemplateValue(template.typeParams, args);
	if (typeParams !== void 0 && !isAuthoringTemplateRecord(typeParams)) throw new Error(`Resolved authoring typeParams must be an object for codec "${template.codecId}", received ${String(typeParams)}`);
	return {
		codecId: template.codecId,
		nativeType,
		...typeParams === void 0 ? {} : { typeParams }
	};
}
function resolveAuthoringColumnDefaultTemplate(template, args) {
	if (template.kind === "literal") {
		const value = resolveAuthoringTemplateValue(template.value, args);
		if (value === void 0) throw new Error("Resolved authoring literal default must not be undefined");
		return {
			kind: "literal",
			value
		};
	}
	const expression = resolveAuthoringTemplateValue(template.expression, args);
	if (expression === void 0 || typeof expression === "object" && expression !== null) throw new Error(`Resolved authoring function default expression must resolve to a primitive, received ${String(expression)}`);
	return {
		kind: "function",
		expression: String(expression)
	};
}
function instantiateAuthoringTypeConstructor(descriptor, args) {
	return resolveAuthoringStorageTypeTemplate(descriptor.output, args);
}
function instantiateAuthoringFieldPreset(descriptor, args) {
	return {
		descriptor: resolveAuthoringStorageTypeTemplate(descriptor.output, args),
		nullable: descriptor.output.nullable ?? false,
		...ifDefined("default", descriptor.output.default !== void 0 ? resolveAuthoringColumnDefaultTemplate(descriptor.output.default, args) : void 0),
		...ifDefined("executionDefault", descriptor.output.executionDefault !== void 0 ? resolveAuthoringTemplateValue(descriptor.output.executionDefault, args) : void 0),
		id: descriptor.output.id ?? false,
		unique: descriptor.output.unique ?? false
	};
}

//#endregion
export { instantiateAuthoringFieldPreset, instantiateAuthoringTypeConstructor, isAuthoringArgRef, isAuthoringFieldPresetDescriptor, isAuthoringTypeConstructorDescriptor, resolveAuthoringTemplateValue, validateAuthoringHelperArguments };
//# sourceMappingURL=authoring.mjs.map