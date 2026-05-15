//#region src/control/control-capabilities.ts
function hasMigrations(target) {
	return "migrations" in target && !!target["migrations"];
}
function hasSchemaView(instance) {
	return "toSchemaView" in instance && typeof instance["toSchemaView"] === "function";
}
function hasPslContractInfer(instance) {
	return "inferPslContract" in instance && typeof instance["inferPslContract"] === "function";
}
function hasOperationPreview(instance) {
	return "toOperationPreview" in instance && typeof instance["toOperationPreview"] === "function";
}

//#endregion
//#region src/control/control-result-types.ts
const VERIFY_CODE_MARKER_MISSING = "PN-RUN-3001";
const VERIFY_CODE_HASH_MISMATCH = "PN-RUN-3002";
const VERIFY_CODE_TARGET_MISMATCH = "PN-RUN-3003";
const VERIFY_CODE_SCHEMA_FAILURE = "PN-RUN-3010";

//#endregion
//#region src/control/control-schema-view.ts
var SchemaTreeNode = class {
	kind;
	id;
	label;
	meta;
	children;
	constructor(options) {
		this.kind = options.kind;
		this.id = options.id;
		this.label = options.label;
		if (options.meta !== void 0) this.meta = options.meta;
		if (options.children !== void 0) this.children = options.children;
		Object.freeze(this);
	}
	accept(visitor) {
		return visitor.visit(this);
	}
};

//#endregion
//#region src/control/control-stack.ts
function addUniqueId(ids, seen, id) {
	if (!seen.has(id)) {
		ids.push(id);
		seen.add(id);
	}
}
function assertUniqueCodecOwner(options) {
	const existingOwner = options.owners.get(options.codecId);
	if (existingOwner !== void 0) throw new Error(`Duplicate ${options.entityLabel} for codecId "${options.codecId}". Descriptor "${options.descriptorId}" conflicts with "${existingOwner}". Each codecId can only have one ${options.entityOwnershipLabel}.`);
}
function extractCodecTypeImports(descriptors) {
	const imports = [];
	for (const descriptor of descriptors) {
		const codecTypes = descriptor.types?.codecTypes;
		if (codecTypes?.import) imports.push(codecTypes.import);
		if (codecTypes?.typeImports) imports.push(...codecTypes.typeImports);
	}
	return imports;
}
function extractOperationTypeImports(descriptors) {
	const imports = [];
	for (const descriptor of descriptors) {
		const operationTypes = descriptor.types?.operationTypes;
		if (operationTypes?.import) imports.push(operationTypes.import);
	}
	return imports;
}
function extractQueryOperationTypeImports(descriptors) {
	const imports = [];
	for (const descriptor of descriptors) {
		const queryOperationTypes = descriptor.types?.queryOperationTypes;
		if (queryOperationTypes?.import) imports.push(queryOperationTypes.import);
	}
	return imports;
}
function extractComponentIds(family, target, adapter, extensions) {
	const ids = [];
	const seen = /* @__PURE__ */ new Set();
	addUniqueId(ids, seen, family.id);
	addUniqueId(ids, seen, target.id);
	if (adapter) addUniqueId(ids, seen, adapter.id);
	for (const ext of extensions) addUniqueId(ids, seen, ext.id);
	return ids;
}
function isTypeConstructorDescriptor(value) {
	return typeof value === "object" && value !== null && value.kind === "typeConstructor";
}
function isFieldPresetDescriptor(value) {
	return typeof value === "object" && value !== null && value.kind === "fieldPreset";
}
function mergeAuthoringNamespaces(target, source, path, leafGuard, label) {
	const assertSafePath = (currentPath) => {
		const blockedSegment = currentPath.find((segment) => segment === "__proto__" || segment === "constructor" || segment === "prototype");
		if (blockedSegment) throw new Error(`Invalid authoring ${label} helper "${currentPath.join(".")}". Helper path segments must not use "${blockedSegment}".`);
	};
	for (const [key, sourceValue] of Object.entries(source)) {
		const currentPath = [...path, key];
		assertSafePath(currentPath);
		const hasExistingValue = Object.hasOwn(target, key);
		const existingValue = hasExistingValue ? target[key] : void 0;
		if (!hasExistingValue) {
			target[key] = sourceValue;
			continue;
		}
		const existingIsLeaf = leafGuard(existingValue);
		const sourceIsLeaf = leafGuard(sourceValue);
		if (existingIsLeaf || sourceIsLeaf) throw new Error(`Duplicate authoring ${label} helper "${currentPath.join(".")}". Descriptor contributions must be unique across composed components.`);
		mergeAuthoringNamespaces(existingValue, sourceValue, currentPath, leafGuard, label);
	}
}
function assembleAuthoringContributions(descriptors) {
	const field = {};
	const type = {};
	for (const descriptor of descriptors) {
		if (descriptor.authoring?.field) mergeAuthoringNamespaces(field, descriptor.authoring.field, [], isFieldPresetDescriptor, "field");
		if (!descriptor.authoring?.type) continue;
		mergeAuthoringNamespaces(type, descriptor.authoring.type, [], isTypeConstructorDescriptor, "type");
	}
	return {
		field,
		type
	};
}
function assembleScalarTypeDescriptors(descriptors) {
	const result = /* @__PURE__ */ new Map();
	const owners = /* @__PURE__ */ new Map();
	for (const descriptor of descriptors) {
		const descriptorMap = descriptor.scalarTypeDescriptors;
		if (!descriptorMap) continue;
		const descriptorId = descriptor.id ?? "<unknown>";
		for (const [typeName, codecId] of descriptorMap) {
			const existingOwner = owners.get(typeName);
			if (existingOwner !== void 0) throw new Error(`Duplicate scalar type descriptor "${typeName}". Descriptor "${descriptorId}" conflicts with "${existingOwner}".`);
			result.set(typeName, codecId);
			owners.set(typeName, descriptorId);
		}
	}
	return result;
}
function assembleControlMutationDefaults(descriptors) {
	const defaultFunctionRegistry = /* @__PURE__ */ new Map();
	const functionOwners = /* @__PURE__ */ new Map();
	const generatorMap = /* @__PURE__ */ new Map();
	const generatorOwners = /* @__PURE__ */ new Map();
	for (const descriptor of descriptors) {
		const contributions = descriptor.controlMutationDefaults;
		if (!contributions) continue;
		const descriptorId = descriptor.id ?? "<unknown>";
		for (const generatorDescriptor of contributions.generatorDescriptors) {
			const existingOwner = generatorOwners.get(generatorDescriptor.id);
			if (existingOwner !== void 0) throw new Error(`Duplicate mutation default generator id "${generatorDescriptor.id}". Descriptor "${descriptorId}" conflicts with "${existingOwner}".`);
			generatorMap.set(generatorDescriptor.id, generatorDescriptor);
			generatorOwners.set(generatorDescriptor.id, descriptorId);
		}
		for (const [functionName, handler] of contributions.defaultFunctionRegistry) {
			const existingOwner = functionOwners.get(functionName);
			if (existingOwner !== void 0) throw new Error(`Duplicate mutation default function "${functionName}". Descriptor "${descriptorId}" conflicts with "${existingOwner}".`);
			defaultFunctionRegistry.set(functionName, handler);
			functionOwners.set(functionName, descriptorId);
		}
	}
	return {
		defaultFunctionRegistry,
		generatorDescriptors: Array.from(generatorMap.values())
	};
}
function extractCodecLookup(descriptors) {
	const byId = /* @__PURE__ */ new Map();
	const owners = /* @__PURE__ */ new Map();
	for (const descriptor of descriptors) {
		const codecInstances = descriptor.types?.codecTypes?.codecInstances;
		if (!codecInstances) continue;
		const descriptorId = descriptor.id ?? "<unknown>";
		for (const codec of codecInstances) {
			assertUniqueCodecOwner({
				codecId: codec.id,
				owners,
				descriptorId,
				entityLabel: "codec instance",
				entityOwnershipLabel: "codec instance provider"
			});
			owners.set(codec.id, descriptorId);
			byId.set(codec.id, codec);
		}
	}
	return { get: (id) => byId.get(id) };
}
function createControlStack(input) {
	const { family, target, adapter, driver, extensionPacks = [] } = input;
	const allDescriptors = [
		family,
		target,
		...adapter ? [adapter] : [],
		...extensionPacks
	];
	const codecLookup = extractCodecLookup(allDescriptors);
	const scalarTypeDescriptors = assembleScalarTypeDescriptors(allDescriptors);
	return {
		family,
		target,
		adapter,
		driver,
		extensionPacks,
		codecTypeImports: extractCodecTypeImports(allDescriptors),
		operationTypeImports: extractOperationTypeImports(allDescriptors),
		queryOperationTypeImports: extractQueryOperationTypeImports(allDescriptors),
		extensionIds: extractComponentIds(family, target, adapter, extensionPacks),
		codecLookup,
		authoringContributions: assembleAuthoringContributions(allDescriptors),
		scalarTypeDescriptors,
		controlMutationDefaults: assembleControlMutationDefaults(allDescriptors)
	};
}

//#endregion
export { SchemaTreeNode, VERIFY_CODE_HASH_MISMATCH, VERIFY_CODE_MARKER_MISSING, VERIFY_CODE_SCHEMA_FAILURE, VERIFY_CODE_TARGET_MISMATCH, assembleAuthoringContributions, assembleControlMutationDefaults, assembleScalarTypeDescriptors, assertUniqueCodecOwner, createControlStack, extractCodecLookup, extractCodecTypeImports, extractComponentIds, extractOperationTypeImports, extractQueryOperationTypeImports, hasMigrations, hasOperationPreview, hasPslContractInfer, hasSchemaView };
//# sourceMappingURL=control.mjs.map