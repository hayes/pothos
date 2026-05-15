import { type } from "arktype";

//#region src/validate-contract.ts
var ContractValidationError = class extends Error {
	code = "CONTRACT.VALIDATION_FAILED";
	phase;
	constructor(message, phase) {
		super(message);
		this.name = "ContractValidationError";
		this.phase = phase;
	}
};
const ContractSchema = type({
	target: "string",
	targetFamily: "string",
	roots: "Record<string, string>",
	models: "Record<string, unknown>",
	"valueObjects?": "Record<string, unknown>",
	storage: "Record<string, unknown>",
	capabilities: "Record<string, Record<string, boolean>>",
	extensionPacks: "Record<string, unknown>",
	meta: "Record<string, unknown>",
	"execution?": {
		"executionHash?": "string",
		mutations: { defaults: "unknown[]" }
	},
	profileHash: "string"
});
function stripPersistenceFields(raw) {
	const { schemaVersion: _, _generated: _g, ...rest } = raw;
	return rest;
}
function extractDomainShape(contract) {
	return {
		roots: contract.roots,
		models: contract.models,
		...contract.valueObjects ? { valueObjects: contract.valueObjects } : {}
	};
}
/**
* Framework-level contract validation (ADR 182).
*
* Three-pass validation:
* 1. **Structural validation** (arktype): verifies required fields exist with
*    correct base types.
* 2. **Domain validation** (framework-owned): roots, relation targets,
*    variant/base consistency, discriminators, ownership, orphans.
* 3. **Storage validation** (family-provided): SQL validates tables/columns/FKs;
*    Mongo validates collections/embedding.
*
* JSON persistence fields (`schemaVersion`, `_generated`) are stripped before
* validation — they are not part of the in-memory contract representation.
*
* @template TContract  The fully-typed contract type (preserves literal types).
* @param value           Raw contract value (e.g. parsed from JSON).
* @param storageValidator  Family-specific storage validation function.
* @returns The validated contract with full literal types.
*/
function validateContract(value, storageValidator) {
	if (typeof value !== "object" || value === null) throw new ContractValidationError("Contract must be a non-null object", "structural");
	const parsed = ContractSchema(stripPersistenceFields(value));
	if (parsed instanceof type.errors) throw new ContractValidationError(`Invalid contract structure: ${parsed.summary}`, "structural");
	const contract = parsed;
	validateContractDomain(extractDomainShape(contract));
	storageValidator(contract);
	return contract;
}

//#endregion
//#region src/validate-domain.ts
function validateContractDomain(contract) {
	const errors = [];
	const modelNames = new Set(Object.keys(contract.models));
	validateRoots(contract, modelNames, errors);
	validateVariantsAndBases(contract, modelNames, errors);
	validateRelationTargets(contract, modelNames, errors);
	validateDiscriminators(contract, errors);
	validateOwnership(contract, modelNames, errors);
	validateValueObjectReferences(contract, errors);
	validateFieldModifiers(contract, errors);
	if (errors.length > 0) throw new ContractValidationError(`Contract domain validation failed:\n- ${errors.join("\n- ")}`, "domain");
}
function validateRoots(contract, modelNames, errors) {
	const seenValues = /* @__PURE__ */ new Set();
	for (const [rootKey, modelName] of Object.entries(contract.roots)) {
		if (seenValues.has(modelName)) errors.push(`Duplicate root value: "${modelName}" is mapped by multiple root keys`);
		seenValues.add(modelName);
		if (!modelNames.has(modelName)) errors.push(`Root "${rootKey}" references model "${modelName}" which does not exist in models`);
	}
}
function validateVariantsAndBases(contract, modelNames, errors) {
	const models = new Map(Object.entries(contract.models));
	for (const [modelName, model] of models) {
		if (model.variants) for (const variantName of Object.keys(model.variants)) {
			if (!modelNames.has(variantName)) {
				errors.push(`Model "${modelName}" lists variant "${variantName}" which does not exist in models`);
				continue;
			}
			const variantModel = models.get(variantName);
			if (!variantModel) continue;
			if (variantModel.base !== modelName) errors.push(`Variant "${variantName}" has base "${variantModel.base ?? "(none)"}" but expected "${modelName}"`);
		}
		if (model.base) {
			if (!modelNames.has(model.base)) {
				errors.push(`Model "${modelName}" has base "${model.base}" which does not exist in models`);
				continue;
			}
			const baseModel = models.get(model.base);
			if (!baseModel) continue;
			if (!baseModel.variants || !Object.hasOwn(baseModel.variants, modelName)) errors.push(`Model "${modelName}" has base "${model.base}" which does not list it as a variant`);
		}
	}
}
function validateRelationTargets(contract, modelNames, errors) {
	for (const [modelName, model] of Object.entries(contract.models)) for (const [relName, relation] of Object.entries(model.relations ?? {})) if (!modelNames.has(relation.to)) errors.push(`Relation "${relName}" on model "${modelName}" targets "${relation.to}" which does not exist in models`);
}
function validateDiscriminators(contract, errors) {
	for (const [modelName, model] of Object.entries(contract.models)) {
		if (model.discriminator) {
			if (!model.variants || Object.keys(model.variants).length === 0) errors.push(`Model "${modelName}" has discriminator but no variants`);
			if (!Object.hasOwn(model.fields, model.discriminator.field)) errors.push(`Discriminator field "${model.discriminator.field}" is not a field on model "${modelName}"`);
		}
		if (model.variants && Object.keys(model.variants).length > 0 && !model.discriminator) errors.push(`Model "${modelName}" has variants but no discriminator`);
		if (model.base) {
			if (model.discriminator) errors.push(`Model "${modelName}" has base and must not have discriminator`);
			if (model.variants && Object.keys(model.variants).length > 0) errors.push(`Model "${modelName}" has base and must not have variants`);
		}
	}
}
function validateOwnership(contract, modelNames, errors) {
	for (const [modelName, model] of Object.entries(contract.models)) {
		if (!model.owner) continue;
		if (model.owner === modelName) errors.push(`Model "${modelName}" cannot own itself`);
		if (!modelNames.has(model.owner)) errors.push(`Model "${modelName}" has owner "${model.owner}" which does not exist in models`);
		for (const [rootKey, rootModel] of Object.entries(contract.roots)) if (rootModel === modelName) errors.push(`Owned model "${modelName}" must not appear in roots (found as root "${rootKey}")`);
	}
}
function forEachContractField(contract, callback) {
	for (const [modelName, model] of Object.entries(contract.models)) for (const [fieldName, field] of Object.entries(model.fields)) callback(field, `Model "${modelName}" field "${fieldName}"`);
	for (const [voName, vo] of Object.entries(contract.valueObjects ?? {})) for (const [fieldName, field] of Object.entries(vo.fields)) callback(field, `Value object "${voName}" field "${fieldName}"`);
}
function validateValueObjectReferences(contract, errors) {
	const voNames = new Set(Object.keys(contract.valueObjects ?? {}));
	function checkType(type$1, location) {
		if (!type$1) return;
		if (type$1.kind === "valueObject" && type$1.name && !voNames.has(type$1.name)) {
			errors.push(`${location} references value object "${type$1.name}" which does not exist in valueObjects`);
			return;
		}
		if (type$1.kind === "union") for (const member of type$1.members ?? []) checkType(member, location);
	}
	forEachContractField(contract, (field, location) => {
		checkType(field?.type, location);
	});
}
function validateFieldModifiers(contract, errors) {
	forEachContractField(contract, (field, location) => {
		const f = field;
		if (f?.many && f?.dict) errors.push(`${location} cannot have both "many" and "dict" modifiers`);
	});
}

//#endregion
export { ContractValidationError as n, validateContract as r, validateContractDomain as t };
//# sourceMappingURL=validate-domain-CpCcTlqJ.mjs.map