import { computeExecutionHash, computeProfileHash, computeStorageHash } from "@prisma-next/contract/hashing";
import { coreHash } from "@prisma-next/contract/types";
import { applyFkDefaults } from "@prisma-next/sql-contract/types";
import { validateStorageSemantics } from "@prisma-next/sql-contract/validators";
import { ifDefined } from "@prisma-next/utils/defined";
import { instantiateAuthoringFieldPreset, instantiateAuthoringTypeConstructor, isAuthoringFieldPresetDescriptor, isAuthoringTypeConstructorDescriptor, validateAuthoringHelperArguments } from "@prisma-next/framework-components/authoring";

//#region src/build-contract.ts
function encodeDefaultLiteralValue(value, codecId, codecLookup) {
	const codec = codecLookup?.get(codecId);
	if (codec) return codec.encodeJson(value);
	return value;
}
function encodeColumnDefault(defaultInput, codecId, codecLookup) {
	if (defaultInput.kind === "function") return {
		kind: "function",
		expression: defaultInput.expression
	};
	return {
		kind: "literal",
		value: encodeDefaultLiteralValue(defaultInput.value, codecId, codecLookup)
	};
}
function assertStorageSemantics(storage) {
	const semanticErrors = validateStorageSemantics(storage);
	if (semanticErrors.length > 0) throw new Error(`Contract semantic validation failed: ${semanticErrors.join("; ")}`);
}
function assertKnownTargetModel(modelsByName, sourceModelName, targetModelName, context) {
	const targetModel = modelsByName.get(targetModelName);
	if (!targetModel) throw new Error(`${context} on model "${sourceModelName}" references unknown model "${targetModelName}"`);
	return targetModel;
}
function assertTargetTableMatches(sourceModelName, targetModel, referencedTableName, context) {
	if (targetModel.tableName !== referencedTableName) throw new Error(`${context} on model "${sourceModelName}" references table "${referencedTableName}" but model "${targetModel.modelName}" maps to "${targetModel.tableName}"`);
}
function isValueObjectField(field$1) {
	return "valueObjectName" in field$1;
}
const JSONB_CODEC_ID = "pg/jsonb@1";
const JSONB_NATIVE_TYPE = "jsonb";
function buildStorageColumn(field$1, codecLookup) {
	if (isValueObjectField(field$1)) {
		const encodedDefault$1 = field$1.default !== void 0 ? encodeColumnDefault(field$1.default, JSONB_CODEC_ID, codecLookup) : void 0;
		return {
			nativeType: JSONB_NATIVE_TYPE,
			codecId: JSONB_CODEC_ID,
			nullable: field$1.nullable,
			...ifDefined("default", encodedDefault$1)
		};
	}
	if (field$1.many) return {
		nativeType: JSONB_NATIVE_TYPE,
		codecId: JSONB_CODEC_ID,
		nullable: field$1.nullable
	};
	const codecId = field$1.descriptor.codecId;
	const encodedDefault = field$1.default !== void 0 ? encodeColumnDefault(field$1.default, codecId, codecLookup) : void 0;
	return {
		nativeType: field$1.descriptor.nativeType,
		codecId,
		nullable: field$1.nullable,
		...ifDefined("typeParams", field$1.descriptor.typeParams),
		...ifDefined("default", encodedDefault),
		...ifDefined("typeRef", field$1.descriptor.typeRef)
	};
}
function buildDomainField(field$1, column) {
	if (isValueObjectField(field$1)) return {
		type: {
			kind: "valueObject",
			name: field$1.valueObjectName
		},
		nullable: field$1.nullable,
		...field$1.many ? { many: true } : {}
	};
	return {
		type: {
			kind: "scalar",
			codecId: column.codecId,
			...ifDefined("typeParams", column.typeParams)
		},
		nullable: column.nullable,
		...field$1.many ? { many: true } : {}
	};
}
function buildSqlContractFromDefinition(definition, codecLookup) {
	const target = definition.target.targetId;
	const targetFamily = "sql";
	const modelsByName = new Map(definition.models.map((m) => [m.modelName, m]));
	const storageTables = {};
	const executionDefaults = [];
	const models = {};
	const roots = {};
	for (const semanticModel of definition.models) {
		const tableName = semanticModel.tableName;
		roots[tableName] = semanticModel.modelName;
		const columns = {};
		const fieldToColumn = {};
		const domainFields = {};
		const domainFieldRefs = {};
		for (const field$1 of semanticModel.fields) {
			if (field$1.executionDefault) {
				if (field$1.default !== void 0) throw new Error(`Field "${semanticModel.modelName}.${field$1.fieldName}" cannot define both default and executionDefault.`);
				if (field$1.nullable) throw new Error(`Field "${semanticModel.modelName}.${field$1.fieldName}" cannot be nullable when executionDefault is present.`);
			}
			const column = buildStorageColumn(field$1, codecLookup);
			columns[field$1.columnName] = column;
			fieldToColumn[field$1.fieldName] = field$1.columnName;
			domainFields[field$1.fieldName] = buildDomainField(field$1, column);
			if (isValueObjectField(field$1)) domainFieldRefs[field$1.fieldName] = {
				kind: "valueObject",
				name: field$1.valueObjectName,
				...field$1.many ? { many: true } : {}
			};
			else if (field$1.many) domainFieldRefs[field$1.fieldName] = {
				kind: "scalar",
				many: true
			};
			if ("executionDefault" in field$1 && field$1.executionDefault) executionDefaults.push({
				ref: {
					table: tableName,
					column: field$1.columnName
				},
				onCreate: field$1.executionDefault
			});
		}
		if (semanticModel.id) {
			const fieldsByColumnName = new Map(semanticModel.fields.map((field$1) => [field$1.columnName, field$1]));
			for (const columnName of semanticModel.id.columns) {
				const field$1 = fieldsByColumnName.get(columnName);
				if (field$1?.nullable) throw new Error(`Model "${semanticModel.modelName}" uses nullable field "${field$1.fieldName}" in its identity.`);
			}
		}
		const foreignKeys = (semanticModel.foreignKeys ?? []).map((fk) => {
			const targetModel = assertKnownTargetModel(modelsByName, semanticModel.modelName, fk.references.model, "Foreign key");
			assertTargetTableMatches(semanticModel.modelName, targetModel, fk.references.table, "Foreign key");
			return {
				columns: fk.columns,
				references: {
					table: fk.references.table,
					columns: fk.references.columns
				},
				...applyFkDefaults({
					...ifDefined("constraint", fk.constraint),
					...ifDefined("index", fk.index)
				}, definition.foreignKeyDefaults),
				...ifDefined("name", fk.name),
				...ifDefined("onDelete", fk.onDelete),
				...ifDefined("onUpdate", fk.onUpdate)
			};
		});
		storageTables[tableName] = {
			columns,
			uniques: (semanticModel.uniques ?? []).map((u) => ({
				columns: u.columns,
				...ifDefined("name", u.name)
			})),
			indexes: (semanticModel.indexes ?? []).map((i) => ({
				columns: i.columns,
				...ifDefined("name", i.name),
				...ifDefined("using", i.using),
				...ifDefined("config", i.config)
			})),
			foreignKeys,
			...semanticModel.id ? { primaryKey: {
				columns: semanticModel.id.columns,
				...ifDefined("name", semanticModel.id.name)
			} } : {}
		};
		const storageFields = {};
		for (const [fieldName, columnName] of Object.entries(fieldToColumn)) storageFields[fieldName] = { column: columnName };
		const columnToField = new Map(Object.entries(fieldToColumn).map(([field$1, col]) => [col, field$1]));
		const modelRelations = {};
		for (const relation of semanticModel.relations ?? []) {
			const targetModel = assertKnownTargetModel(modelsByName, semanticModel.modelName, relation.toModel, "Relation");
			assertTargetTableMatches(semanticModel.modelName, targetModel, relation.toTable, "Relation");
			if (relation.cardinality === "N:M" && !relation.through) throw new Error(`Relation "${semanticModel.modelName}.${relation.fieldName}" with cardinality "N:M" requires through metadata`);
			const targetColumnToField = new Map(targetModel.fields.map((f) => [f.columnName, f.fieldName]));
			modelRelations[relation.fieldName] = {
				to: relation.toModel,
				cardinality: relation.cardinality,
				on: {
					localFields: relation.on.parentColumns.map((col) => columnToField.get(col) ?? col),
					targetFields: relation.on.childColumns.map((col) => targetColumnToField.get(col) ?? col)
				},
				...relation.through ? { through: {
					table: relation.through.table,
					parentCols: relation.through.parentColumns,
					childCols: relation.through.childColumns
				} } : void 0
			};
		}
		models[semanticModel.modelName] = {
			storage: {
				table: tableName,
				fields: storageFields
			},
			fields: domainFields,
			relations: modelRelations
		};
	}
	const storageWithoutHash = {
		tables: storageTables,
		types: definition.storageTypes ?? {}
	};
	const storageHash = definition.storageHash ? coreHash(definition.storageHash) : computeStorageHash({
		target,
		targetFamily,
		storage: storageWithoutHash
	});
	const storage = {
		...storageWithoutHash,
		storageHash
	};
	const executionSection = executionDefaults.length > 0 ? { mutations: { defaults: executionDefaults.sort((a, b) => {
		const tableCompare = a.ref.table.localeCompare(b.ref.table);
		if (tableCompare !== 0) return tableCompare;
		return a.ref.column.localeCompare(b.ref.column);
	}) } } : void 0;
	const extensionNamespaces = definition.extensionPacks ? Object.values(definition.extensionPacks).map((pack) => pack.id) : void 0;
	const extensionPacks = { ...definition.extensionPacks || {} };
	if (extensionNamespaces) {
		for (const namespace of extensionNamespaces) if (!Object.hasOwn(extensionPacks, namespace)) extensionPacks[namespace] = {};
	}
	const capabilities = definition.capabilities || {};
	const profileHash = computeProfileHash({
		target,
		targetFamily,
		capabilities
	});
	const executionWithHash = executionSection ? {
		...executionSection,
		executionHash: computeExecutionHash({
			target,
			targetFamily,
			execution: executionSection
		})
	} : void 0;
	const valueObjects = definition.valueObjects && definition.valueObjects.length > 0 ? Object.fromEntries(definition.valueObjects.map((vo) => [vo.name, { fields: Object.fromEntries(vo.fields.map((f) => [f.fieldName, isValueObjectField(f) ? {
		type: {
			kind: "valueObject",
			name: f.valueObjectName
		},
		nullable: f.nullable,
		...f.many ? { many: true } : {}
	} : {
		type: {
			kind: "scalar",
			codecId: f.descriptor.codecId,
			...ifDefined("typeParams", f.descriptor.typeParams)
		},
		nullable: f.nullable
	}])) }])) : void 0;
	const contract = {
		target,
		targetFamily,
		models,
		roots,
		storage,
		...executionWithHash ? { execution: executionWithHash } : {},
		...ifDefined("valueObjects", valueObjects),
		extensionPacks,
		capabilities,
		profileHash,
		meta: {}
	};
	assertStorageSemantics(contract.storage);
	return contract;
}

//#endregion
//#region src/authoring-helper-runtime.ts
function isNamedConstraintOptionsLike(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	if (Object.keys(value).some((key) => key !== "name")) return false;
	const name = value.name;
	return name === void 0 || typeof name === "string";
}
const blockedSegments = new Set([
	"__proto__",
	"constructor",
	"prototype"
]);
function assertSafeHelperKey(key, path) {
	if (blockedSegments.has(key)) throw new Error(`Invalid authoring helper "${[...path, key].join(".")}". Helper path segments must not use "${key}".`);
}
function createTypeHelpersFromNamespace(namespace, path = []) {
	const helpers = {};
	for (const [key, value] of Object.entries(namespace)) {
		assertSafeHelperKey(key, path);
		const currentPath = [...path, key];
		if (isAuthoringTypeConstructorDescriptor(value)) {
			const helperPath = currentPath.join(".");
			helpers[key] = (...args) => {
				validateAuthoringHelperArguments(helperPath, value.args, args);
				return instantiateAuthoringTypeConstructor(value, args);
			};
			continue;
		}
		helpers[key] = createTypeHelpersFromNamespace(value, currentPath);
	}
	return helpers;
}
function createFieldPresetHelper(options) {
	return (...rawArgs) => {
		const acceptsNamedConstraintOptions = options.descriptor.output.id === true || options.descriptor.output.unique === true;
		const declaredArguments = options.descriptor.args ?? [];
		if (acceptsNamedConstraintOptions && rawArgs.length > declaredArguments.length + 1) throw new Error(`${options.helperPath} expects at most ${declaredArguments.length + 1} argument(s), received ${rawArgs.length}`);
		let args = rawArgs;
		let namedConstraintOptions;
		if (acceptsNamedConstraintOptions && rawArgs.length === declaredArguments.length + 1) {
			const maybeNamedConstraintOptions = rawArgs.at(-1);
			if (!isNamedConstraintOptionsLike(maybeNamedConstraintOptions)) throw new Error(`${options.helperPath} accepts an optional trailing { name?: string } constraint options object`);
			namedConstraintOptions = maybeNamedConstraintOptions;
			args = rawArgs.slice(0, -1);
		}
		validateAuthoringHelperArguments(options.helperPath, options.descriptor.args, args);
		return options.build({
			args,
			...namedConstraintOptions ? { namedConstraintOptions } : {}
		});
	};
}
function createFieldHelpersFromNamespace(namespace, createLeafHelper, path = []) {
	const helpers = {};
	for (const [key, value] of Object.entries(namespace)) {
		assertSafeHelperKey(key, path);
		const currentPath = [...path, key];
		if (isAuthoringFieldPresetDescriptor(value)) {
			helpers[key] = createLeafHelper({
				helperPath: currentPath.join("."),
				descriptor: value
			});
			continue;
		}
		helpers[key] = createFieldHelpersFromNamespace(value, createLeafHelper, currentPath);
	}
	return helpers;
}

//#endregion
//#region src/contract-dsl.ts
function isColumnDefault(value) {
	if (typeof value !== "object" || value === null) return false;
	const kind = value.kind;
	return kind === "literal" || kind === "function";
}
function toColumnDefault(value) {
	if (isColumnDefault(value)) return value;
	return {
		kind: "literal",
		value
	};
}
var ScalarFieldBuilder = class ScalarFieldBuilder {
	constructor(state) {
		this.state = state;
	}
	optional() {
		return new ScalarFieldBuilder({
			...this.state,
			nullable: true
		});
	}
	column(name) {
		return new ScalarFieldBuilder({
			...this.state,
			columnName: name
		});
	}
	default(value) {
		return new ScalarFieldBuilder({
			...this.state,
			default: toColumnDefault(value)
		});
	}
	defaultSql(expression) {
		return new ScalarFieldBuilder({
			...this.state,
			default: {
				kind: "function",
				expression
			}
		});
	}
	id(options) {
		return new ScalarFieldBuilder({
			...this.state,
			id: options?.name ? { name: options.name } : {}
		});
	}
	unique(options) {
		return new ScalarFieldBuilder({
			...this.state,
			unique: options?.name ? { name: options.name } : {}
		});
	}
	sql(spec) {
		const idSpec = "id" in spec ? spec.id : void 0;
		const uniqueSpec = "unique" in spec ? spec.unique : void 0;
		if (idSpec && !this.state.id) throw new Error("field.sql({ id }) requires an existing inline .id(...) declaration.");
		if (uniqueSpec && !this.state.unique) throw new Error("field.sql({ unique }) requires an existing inline .unique(...) declaration.");
		return new ScalarFieldBuilder({
			...this.state,
			...spec.column ? { columnName: spec.column } : {},
			...idSpec ? { id: { name: idSpec.name } } : {},
			...uniqueSpec ? { unique: { name: uniqueSpec.name } } : {}
		});
	}
	build() {
		return this.state;
	}
};
function columnField(descriptor) {
	return new ScalarFieldBuilder({
		kind: "scalar",
		descriptor,
		nullable: false
	});
}
function generatedField(spec) {
	return new ScalarFieldBuilder({
		kind: "scalar",
		descriptor: {
			...spec.type,
			...spec.typeParams ? { typeParams: spec.typeParams } : {}
		},
		nullable: false,
		executionDefault: spec.generated
	});
}
function namedTypeField(typeRef) {
	return new ScalarFieldBuilder({
		kind: "scalar",
		typeRef,
		nullable: false
	});
}
function buildFieldPreset(descriptor, args, namedConstraintOptions) {
	const preset = instantiateAuthoringFieldPreset(descriptor, args);
	return new ScalarFieldBuilder({
		kind: "scalar",
		descriptor: preset.descriptor,
		nullable: preset.nullable,
		...ifDefined("default", preset.default),
		...ifDefined("executionDefault", preset.executionDefault),
		...preset.id ? { id: namedConstraintOptions?.name ? { name: namedConstraintOptions.name } : {} } : {},
		...preset.unique ? { unique: namedConstraintOptions?.name ? { name: namedConstraintOptions.name } : {} } : {}
	});
}
var RelationBuilder = class RelationBuilder {
	constructor(state) {
		this.state = state;
	}
	sql(spec) {
		if (this.state.kind !== "belongsTo") throw new Error("relation.sql(...) is only supported for belongsTo relations.");
		return new RelationBuilder({
			...this.state,
			sql: spec
		});
	}
	build() {
		return this.state;
	}
};
function normalizeFieldRefInput(input) {
	return (Array.isArray(input) ? input : [input]).map((ref) => ref.fieldName);
}
function normalizeTargetFieldRefInput(input) {
	const refs = Array.isArray(input) ? input : [input];
	const [first] = refs;
	if (!first) throw new Error("Expected at least one target ref");
	if (refs.some((ref) => ref.modelName !== first.modelName)) throw new Error("All target refs in a foreign key must point to the same model");
	return {
		modelName: first.modelName,
		fieldNames: refs.map((ref) => ref.fieldName),
		source: refs.some((ref) => ref.source === "string") ? "string" : "token"
	};
}
function createConstraintsDsl() {
	function ref(modelName, fieldName) {
		return {
			kind: "targetFieldRef",
			source: "string",
			modelName,
			fieldName
		};
	}
	function id(fieldOrFields, options) {
		return {
			kind: "id",
			fields: normalizeFieldRefInput(fieldOrFields),
			...options?.name ? { name: options.name } : {}
		};
	}
	function unique(fieldOrFields, options) {
		return {
			kind: "unique",
			fields: normalizeFieldRefInput(fieldOrFields),
			...options?.name ? { name: options.name } : {}
		};
	}
	function index(fieldOrFields, options) {
		return {
			kind: "index",
			fields: normalizeFieldRefInput(fieldOrFields),
			...options?.name ? { name: options.name } : {},
			...options?.using ? { using: options.using } : {},
			...options?.config ? { config: options.config } : {}
		};
	}
	function foreignKey(fieldOrFields, target, options) {
		const normalizedTarget = normalizeTargetFieldRefInput(target);
		return {
			kind: "fk",
			fields: normalizeFieldRefInput(fieldOrFields),
			targetModel: normalizedTarget.modelName,
			targetFields: normalizedTarget.fieldNames,
			targetSource: normalizedTarget.source,
			...options?.name ? { name: options.name } : {},
			...options?.onDelete ? { onDelete: options.onDelete } : {},
			...options?.onUpdate ? { onUpdate: options.onUpdate } : {},
			...options?.constraint !== void 0 ? { constraint: options.constraint } : {},
			...options?.index !== void 0 ? { index: options.index } : {}
		};
	}
	return {
		ref,
		id,
		unique,
		index,
		foreignKey
	};
}
function createFieldRefs(fields) {
	const refs = {};
	for (const fieldName of Object.keys(fields)) refs[fieldName] = {
		kind: "columnRef",
		fieldName
	};
	return refs;
}
function createModelTokenRefs(modelName, fields) {
	const refs = {};
	for (const fieldName of Object.keys(fields)) refs[fieldName] = {
		kind: "targetFieldRef",
		source: "token",
		modelName,
		fieldName
	};
	return refs;
}
function buildStageSpec(stageInput, context) {
	if (typeof stageInput === "function") return stageInput(context);
	return stageInput;
}
function createAttributeConstraintsDsl() {
	const constraints = createConstraintsDsl();
	return {
		id: constraints.id,
		unique: constraints.unique
	};
}
function createSqlConstraintsDsl() {
	const constraints = createConstraintsDsl();
	return {
		index: constraints.index,
		foreignKey: constraints.foreignKey,
		ref: constraints.ref
	};
}
function createColumnRefs(fields) {
	return createFieldRefs(fields);
}
function findDuplicateRelationName(existingRelations, nextRelations) {
	return Object.keys(nextRelations).find((relationName) => Object.hasOwn(existingRelations, relationName));
}
var ContractModelBuilder = class ContractModelBuilder {
	refs;
	constructor(stageOne, attributesFactory, sqlFactory) {
		this.stageOne = stageOne;
		this.attributesFactory = attributesFactory;
		this.sqlFactory = sqlFactory;
		this.refs = stageOne.modelName ? createModelTokenRefs(stageOne.modelName, stageOne.fields) : void 0;
	}
	ref(fieldName) {
		const modelName = this.stageOne.modelName;
		if (!modelName) throw new Error("Model tokens require model(\"ModelName\", ...) before calling .ref(...)");
		return {
			kind: "targetFieldRef",
			source: "token",
			modelName,
			fieldName
		};
	}
	relations(relations) {
		const duplicateRelationName = findDuplicateRelationName(this.stageOne.relations, relations);
		if (duplicateRelationName) throw new Error(`Model "${this.stageOne.modelName ?? "<anonymous>"}" already defines relation "${duplicateRelationName}".`);
		return new ContractModelBuilder({
			...this.stageOne,
			relations: {
				...this.stageOne.relations,
				...relations
			}
		}, this.attributesFactory, this.sqlFactory);
	}
	attributes(specOrFactory) {
		return new ContractModelBuilder(this.stageOne, specOrFactory, this.sqlFactory);
	}
	sql(specOrFactory) {
		return new ContractModelBuilder(this.stageOne, this.attributesFactory, specOrFactory);
	}
	buildAttributesSpec() {
		if (!this.attributesFactory) return;
		return buildStageSpec(this.attributesFactory, {
			fields: createFieldRefs(this.stageOne.fields),
			constraints: createAttributeConstraintsDsl()
		});
	}
	buildSqlSpec() {
		if (!this.sqlFactory) return;
		return buildStageSpec(this.sqlFactory, {
			cols: createColumnRefs(this.stageOne.fields),
			constraints: createSqlConstraintsDsl()
		});
	}
};
function isLazyRelationModelName(value) {
	return typeof value === "object" && value !== null && "kind" in value && value.kind === "lazyRelationModelName" && "resolve" in value && typeof value.resolve === "function";
}
function resolveNamedModelTokenName(token) {
	const modelName = token.stageOne.modelName;
	if (!modelName) throw new Error("Relation targets require named model tokens. Use model(\"ModelName\", ...) before passing a token to rel.*(...).");
	return modelName;
}
function normalizeRelationModelSource(target) {
	if (typeof target === "string") return {
		kind: "relationModelName",
		source: "string",
		modelName: target
	};
	if (typeof target === "function") return {
		kind: "lazyRelationModelName",
		source: "lazyToken",
		resolve: () => resolveNamedModelTokenName(target())
	};
	return {
		kind: "relationModelName",
		source: "token",
		modelName: resolveNamedModelTokenName(target)
	};
}
function model(modelNameOrInput, maybeInput) {
	const input = typeof modelNameOrInput === "string" ? maybeInput : modelNameOrInput;
	if (!input) throw new Error("model(\"ModelName\", ...) requires a model definition.");
	return new ContractModelBuilder({
		...typeof modelNameOrInput === "string" ? { modelName: modelNameOrInput } : {},
		fields: input.fields,
		relations: input.relations ?? {}
	});
}
function belongsTo(toModel, options) {
	return new RelationBuilder({
		kind: "belongsTo",
		toModel: normalizeRelationModelSource(toModel),
		from: options.from,
		to: options.to
	});
}
function hasMany(toModel, options) {
	return new RelationBuilder({
		kind: "hasMany",
		toModel: normalizeRelationModelSource(toModel),
		by: options.by
	});
}
function hasOne(toModel, options) {
	return new RelationBuilder({
		kind: "hasOne",
		toModel: normalizeRelationModelSource(toModel),
		by: options.by
	});
}
function manyToMany(toModel, options) {
	return new RelationBuilder({
		kind: "manyToMany",
		toModel: normalizeRelationModelSource(toModel),
		through: normalizeRelationModelSource(options.through),
		from: options.from,
		to: options.to
	});
}
const rel = {
	belongsTo,
	hasMany,
	hasOne,
	manyToMany
};
const field = {
	column: columnField,
	generated: generatedField,
	namedType: namedTypeField
};
function isContractInput(value) {
	if (typeof value !== "object" || value === null || !("target" in value) || !("family" in value)) return false;
	const target = value.target;
	const family = value.family;
	return typeof target === "object" && target !== null && "kind" in target && target.kind === "target" && typeof family === "object" && family !== null && "kind" in family && family.kind === "family";
}
function isRelationFieldArray(value) {
	return Array.isArray(value);
}
function normalizeRelationFieldNames(value) {
	if (isRelationFieldArray(value)) return value;
	return [value];
}
function resolveRelationModelName(value) {
	if (isLazyRelationModelName(value)) return value.resolve();
	return value.modelName;
}
function applyNaming(name, strategy) {
	if (!strategy || strategy === "identity") return name;
	let result = "";
	for (let index = 0; index < name.length; index += 1) {
		const char = name[index];
		if (!char) continue;
		const lower = char.toLowerCase();
		if (char !== lower && index > 0) {
			const prev = name[index - 1];
			const next = name[index + 1];
			const prevIsLower = !!prev && prev === prev.toLowerCase();
			const nextIsLower = !!next && next === next.toLowerCase();
			if (prevIsLower || nextIsLower) result += "_";
		}
		result += lower;
	}
	return result;
}

//#endregion
//#region src/composed-authoring-helpers.ts
function extractTypeNamespace(pack) {
	return pack.authoring?.type ?? {};
}
function extractFieldNamespace(pack) {
	return pack.authoring?.field ?? {};
}
function mergeHelperNamespaces(target, source, path, leafGuard, label) {
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
		if (existingIsLeaf || sourceIsLeaf) throw new Error(`Duplicate authoring ${label} helper "${currentPath.join(".")}". Helper names must be unique across composed packs.`);
		mergeHelperNamespaces(existingValue, sourceValue, currentPath, leafGuard, label);
	}
}
function composeTypeNamespace(components) {
	const merged = {};
	for (const component of components) {
		const ns = extractTypeNamespace(component);
		if (Object.keys(ns).length > 0) mergeHelperNamespaces(merged, ns, [], isAuthoringTypeConstructorDescriptor, "type");
	}
	return merged;
}
function composeFieldNamespace(components) {
	const merged = {};
	for (const component of components) {
		const ns = extractFieldNamespace(component);
		if (Object.keys(ns).length > 0) mergeHelperNamespaces(merged, ns, [], isAuthoringFieldPresetDescriptor, "field");
	}
	return merged;
}
function createComposedFieldHelpers(components) {
	const helperNamespace = createFieldHelpersFromNamespace(composeFieldNamespace(components), ({ helperPath, descriptor }) => createFieldPresetHelper({
		helperPath,
		descriptor,
		build: ({ args, namedConstraintOptions }) => buildFieldPreset(descriptor, args, namedConstraintOptions)
	}));
	const coreFieldHelpers = {
		column: field.column,
		generated: field.generated,
		namedType: field.namedType
	};
	const coreHelperNames = new Set(Object.keys(coreFieldHelpers));
	for (const helperName of Object.keys(helperNamespace)) if (coreHelperNames.has(helperName)) throw new Error(`Duplicate authoring field helper "${helperName}". Core field helpers reserve that name.`);
	return {
		...coreFieldHelpers,
		...helperNamespace
	};
}
function createComposedAuthoringHelpers(options) {
	const extensionValues = Object.values(options.extensionPacks ?? {});
	const components = [
		options.family,
		options.target,
		...extensionValues
	];
	return {
		field: createComposedFieldHelpers(components),
		model,
		rel,
		type: createTypeHelpersFromNamespace(composeTypeNamespace(components))
	};
}

//#endregion
//#region src/contract-warnings.ts
function hasNamedModelToken(models, modelName) {
	return models[modelName]?.stageOne.modelName === modelName;
}
function formatFieldSelection(fieldNames) {
	if (fieldNames.length === 1) return `'${fieldNames[0]}'`;
	return `[${fieldNames.map((fieldName) => `'${fieldName}'`).join(", ")}]`;
}
function formatTokenFieldSelection(modelName, fieldNames) {
	if (fieldNames.length === 1) return `${modelName}.refs.${fieldNames[0]}`;
	return `[${fieldNames.map((fieldName) => `${modelName}.refs.${fieldName}`).join(", ")}]`;
}
function formatConstraintsRefCall(modelName, fieldNames) {
	if (fieldNames.length === 1) return `constraints.ref('${modelName}', '${fieldNames[0]}')`;
	return `[${fieldNames.map((fieldName) => `constraints.ref('${modelName}', '${fieldName}')`).join(", ")}]`;
}
function formatRelationModelDisplay(relationModel) {
	if (relationModel.kind === "lazyRelationModelName") return `() => ${relationModel.resolve()}`;
	return relationModel.source === "string" ? `'${relationModel.modelName}'` : relationModel.modelName;
}
function formatRelationCall(relation, targetModelDisplay) {
	if (relation.kind === "belongsTo") return `rel.belongsTo(${targetModelDisplay}, { from: ${formatFieldSelection(normalizeRelationFieldNames(relation.from))}, to: ${formatFieldSelection(normalizeRelationFieldNames(relation.to))} })`;
	if (relation.kind === "hasMany" || relation.kind === "hasOne") {
		const by = formatFieldSelection(normalizeRelationFieldNames(relation.by));
		return `rel.${relation.kind}(${targetModelDisplay}, { by: ${by} })`;
	}
	return `rel.manyToMany(${targetModelDisplay}, { through: ${formatRelationModelDisplay(relation.through)}, from: ${formatFieldSelection(normalizeRelationFieldNames(relation.from))}, to: ${formatFieldSelection(normalizeRelationFieldNames(relation.to))} })`;
}
function formatManyToManyCallWithThrough(relation, throughDisplay) {
	return `rel.manyToMany(${formatRelationModelDisplay(relation.toModel)}, { through: ${throughDisplay}, from: ${formatFieldSelection(normalizeRelationFieldNames(relation.from))}, to: ${formatFieldSelection(normalizeRelationFieldNames(relation.to))} })`;
}
const WARNING_BATCH_THRESHOLD = 5;
function flushWarnings(warnings) {
	if (warnings.length === 0) return;
	if (warnings.length <= WARNING_BATCH_THRESHOLD) {
		for (const message of warnings) process.emitWarning(message, { code: "PN_CONTRACT_TYPED_FALLBACK_AVAILABLE" });
		return;
	}
	process.emitWarning(`${warnings.length} contract references use string fallbacks where typed alternatives are available. Use named model tokens and typed storage type refs for autocomplete and type safety.
` + warnings.map((w) => `  - ${w}`).join("\n"), { code: "PN_CONTRACT_TYPED_FALLBACK_AVAILABLE" });
}
function formatFallbackWarning(location, current, suggested) {
	return `Contract ${location} uses ${current}. Use ${suggested} when the named model token is available in the same contract to keep typed relation targets and model refs.`;
}
function emitTypedNamedTypeFallbackWarnings(models, storageTypes) {
	const warnings = [];
	const warnedFields = /* @__PURE__ */ new Set();
	for (const [modelName, modelDefinition] of Object.entries(models)) for (const [fieldName, fieldBuilder] of Object.entries(modelDefinition.stageOne.fields)) {
		const fieldState = fieldBuilder.build();
		if (typeof fieldState.typeRef !== "string" || !(fieldState.typeRef in storageTypes)) continue;
		const warningKey = `${modelName}.${fieldName}`;
		if (warnedFields.has(warningKey)) continue;
		warnedFields.add(warningKey);
		warnings.push(`Contract field "${modelName}.${fieldName}" uses field.namedType('${fieldState.typeRef}'). Use field.namedType(types.${fieldState.typeRef}) when the storage type is declared in the same contract to keep autocomplete and typed local refs.`);
	}
	flushWarnings(warnings);
}
function emitTypedCrossModelFallbackWarnings(collection) {
	const warnings = [];
	const warnedKeys = /* @__PURE__ */ new Set();
	for (const spec of collection.modelSpecs.values()) {
		for (const [relationName, relationBuilder] of Object.entries(spec.relations)) {
			const relation = relationBuilder.build();
			if (relation.toModel.kind === "relationModelName" && relation.toModel.source === "string" && hasNamedModelToken(collection.models, relation.toModel.modelName)) {
				const warningKey = `${spec.modelName}.${relationName}.toModel`;
				if (!warnedKeys.has(warningKey)) {
					warnedKeys.add(warningKey);
					const current = formatRelationCall(relation, `'${relation.toModel.modelName}'`);
					const suggested = formatRelationCall(relation, relation.toModel.modelName);
					warnings.push(formatFallbackWarning(`relation "${spec.modelName}.${relationName}"`, current, suggested));
				}
			}
			if (relation.kind === "manyToMany" && relation.through.kind === "relationModelName" && relation.through.source === "string" && hasNamedModelToken(collection.models, relation.through.modelName)) {
				const warningKey = `${spec.modelName}.${relationName}.through`;
				if (!warnedKeys.has(warningKey)) {
					warnedKeys.add(warningKey);
					const current = formatManyToManyCallWithThrough(relation, `'${relation.through.modelName}'`);
					const suggested = formatManyToManyCallWithThrough(relation, relation.through.modelName);
					warnings.push(formatFallbackWarning(`relation "${spec.modelName}.${relationName}"`, current, suggested));
				}
			}
		}
		for (const [foreignKeyIndex, foreignKey] of (spec.sqlSpec?.foreignKeys ?? []).entries()) {
			if (foreignKey.targetSource !== "string" || !hasNamedModelToken(collection.models, foreignKey.targetModel)) continue;
			const warningKey = `${spec.modelName}.sql.foreignKeys.${foreignKeyIndex}`;
			if (warnedKeys.has(warningKey)) continue;
			warnedKeys.add(warningKey);
			const current = formatConstraintsRefCall(foreignKey.targetModel, foreignKey.targetFields);
			const suggested = formatTokenFieldSelection(foreignKey.targetModel, foreignKey.targetFields);
			warnings.push(formatFallbackWarning(`model "${spec.modelName}"`, `${current} in .sql(...)`, suggested));
		}
	}
	flushWarnings(warnings);
}

//#endregion
//#region src/contract-lowering.ts
function buildStorageTypeReverseLookup(storageTypes) {
	const lookup = /* @__PURE__ */ new Map();
	for (const [key, instance] of Object.entries(storageTypes)) lookup.set(instance, key);
	return lookup;
}
function resolveFieldDescriptor(modelName, fieldName, fieldState, storageTypes, storageTypeReverseLookup) {
	if ("descriptor" in fieldState && fieldState.descriptor) return fieldState.descriptor;
	if ("typeRef" in fieldState && fieldState.typeRef) {
		const typeRef = typeof fieldState.typeRef === "string" ? fieldState.typeRef : storageTypeReverseLookup.get(fieldState.typeRef);
		if (!typeRef) throw new Error(`Field "${modelName}.${fieldName}" references a storage type instance that is not present in definition.types`);
		const referencedType = storageTypes[typeRef];
		if (!referencedType) throw new Error(`Field "${modelName}.${fieldName}" references unknown storage type "${typeRef}"`);
		return {
			codecId: referencedType.codecId,
			nativeType: referencedType.nativeType,
			typeRef
		};
	}
	throw new Error(`Field "${modelName}.${fieldName}" does not resolve to a storage descriptor`);
}
function mapFieldNamesToColumnNames(modelName, fieldNames, fieldToColumn) {
	return fieldNames.map((fieldName) => {
		const columnName = fieldToColumn[fieldName];
		if (!columnName) throw new Error(`Unknown field "${modelName}.${fieldName}" in contract definition`);
		return columnName;
	});
}
function assertRelationFieldArity(params) {
	if (params.leftFields.length === params.rightFields.length) return;
	throw new Error(`Relation "${params.modelName}.${params.relationName}" maps ${params.leftFields.length} ${params.leftLabel} field(s) to ${params.rightFields.length} ${params.rightLabel} field(s).`);
}
function resolveInlineIdConstraint(spec) {
	const inlineIdFields = [];
	let idName;
	for (const [fieldName, fieldBuilder] of Object.entries(spec.fieldBuilders)) {
		const fieldState = fieldBuilder.build();
		if (!fieldState.id) continue;
		inlineIdFields.push(fieldName);
		if (fieldState.id.name) idName = fieldState.id.name;
	}
	if (inlineIdFields.length === 0) return;
	if (inlineIdFields.length > 1) throw new Error(`Model "${spec.modelName}" marks multiple fields with .id(). Use .attributes(...) for compound identities.`);
	const [inlineIdField] = inlineIdFields;
	if (!inlineIdField) return;
	return {
		kind: "id",
		fields: [inlineIdField],
		...idName ? { name: idName } : {}
	};
}
function collectInlineUniqueConstraints(spec) {
	const constraints = [];
	for (const [fieldName, fieldBuilder] of Object.entries(spec.fieldBuilders)) {
		const fieldState = fieldBuilder.build();
		if (!fieldState.unique) continue;
		constraints.push({
			kind: "unique",
			fields: [fieldName],
			...fieldState.unique.name ? { name: fieldState.unique.name } : {}
		});
	}
	return constraints;
}
function resolveModelIdConstraint(spec) {
	const inlineId = resolveInlineIdConstraint(spec);
	const attributeId = spec.attributesSpec?.id;
	if (inlineId && attributeId) throw new Error(`Model "${spec.modelName}" defines identity both inline and in .attributes(...). Pick one identity style.`);
	const resolvedId = attributeId ?? inlineId;
	if (resolvedId && resolvedId.fields.length === 0) throw new Error(`Model "${spec.modelName}" defines an empty identity. Add at least one field.`);
	return resolvedId;
}
function resolveModelUniqueConstraints(spec) {
	const attributeUniques = spec.attributesSpec?.uniques ?? [];
	for (const unique of attributeUniques) if (unique.fields.length === 0) throw new Error(`Model "${spec.modelName}" defines an empty unique constraint. Add at least one field.`);
	return [...collectInlineUniqueConstraints(spec), ...attributeUniques];
}
function resolveRelationForeignKeys(spec, allSpecs) {
	const foreignKeys = [];
	for (const [relationName, relationBuilder] of Object.entries(spec.relations)) {
		const relation = relationBuilder.build();
		if (relation.kind !== "belongsTo" || !relation.sql?.fk) continue;
		const targetModelName = resolveRelationModelName(relation.toModel);
		if (!allSpecs.has(targetModelName)) throw new Error(`Relation "${spec.modelName}.${relationName}" references unknown model "${targetModelName}"`);
		const fields = normalizeRelationFieldNames(relation.from);
		const targetFields = normalizeRelationFieldNames(relation.to);
		assertRelationFieldArity({
			modelName: spec.modelName,
			relationName,
			leftLabel: "source",
			leftFields: fields,
			rightLabel: "target",
			rightFields: targetFields
		});
		foreignKeys.push({
			kind: "fk",
			fields,
			targetModel: targetModelName,
			targetFields,
			...relation.sql.fk.name ? { name: relation.sql.fk.name } : {},
			...relation.sql.fk.onDelete ? { onDelete: relation.sql.fk.onDelete } : {},
			...relation.sql.fk.onUpdate ? { onUpdate: relation.sql.fk.onUpdate } : {},
			...relation.sql.fk.constraint !== void 0 ? { constraint: relation.sql.fk.constraint } : {},
			...relation.sql.fk.index !== void 0 ? { index: relation.sql.fk.index } : {}
		});
	}
	return foreignKeys;
}
function resolveRelationAnchorFields(spec) {
	const idFields = spec.idConstraint?.fields;
	if (idFields && idFields.length > 0) return idFields;
	if ("id" in spec.fieldToColumn) return ["id"];
	throw new Error(`Model "${spec.modelName}" needs an explicit id or an "id" field to anchor non-owning relations`);
}
function lowerBelongsToRelation(relationName, relation, currentSpec, allSpecs) {
	const targetModelName = resolveRelationModelName(relation.toModel);
	const targetSpec = allSpecs.get(targetModelName);
	if (!targetSpec) throw new Error(`Relation "${currentSpec.modelName}.${relationName}" references unknown model "${targetModelName}"`);
	const fromFields = normalizeRelationFieldNames(relation.from);
	const toFields = normalizeRelationFieldNames(relation.to);
	assertRelationFieldArity({
		modelName: currentSpec.modelName,
		relationName,
		leftLabel: "source",
		leftFields: fromFields,
		rightLabel: "target",
		rightFields: toFields
	});
	return {
		fieldName: relationName,
		toModel: targetModelName,
		toTable: targetSpec.tableName,
		cardinality: "N:1",
		on: {
			parentTable: currentSpec.tableName,
			parentColumns: mapFieldNamesToColumnNames(currentSpec.modelName, fromFields, currentSpec.fieldToColumn),
			childTable: targetSpec.tableName,
			childColumns: mapFieldNamesToColumnNames(targetSpec.modelName, toFields, targetSpec.fieldToColumn)
		}
	};
}
function lowerHasOwnershipRelation(relationName, relation, currentSpec, allSpecs) {
	const targetModelName = resolveRelationModelName(relation.toModel);
	const targetSpec = allSpecs.get(targetModelName);
	if (!targetSpec) throw new Error(`Relation "${currentSpec.modelName}.${relationName}" references unknown model "${targetModelName}"`);
	const parentFields = resolveRelationAnchorFields(currentSpec);
	const childFields = normalizeRelationFieldNames(relation.by);
	assertRelationFieldArity({
		modelName: currentSpec.modelName,
		relationName,
		leftLabel: "anchor",
		leftFields: parentFields,
		rightLabel: "child",
		rightFields: childFields
	});
	return {
		fieldName: relationName,
		toModel: targetModelName,
		toTable: targetSpec.tableName,
		cardinality: relation.kind === "hasMany" ? "1:N" : "1:1",
		on: {
			parentTable: currentSpec.tableName,
			parentColumns: mapFieldNamesToColumnNames(currentSpec.modelName, parentFields, currentSpec.fieldToColumn),
			childTable: targetSpec.tableName,
			childColumns: mapFieldNamesToColumnNames(targetSpec.modelName, childFields, targetSpec.fieldToColumn)
		}
	};
}
function lowerManyToManyRelation(relationName, relation, currentSpec, allSpecs) {
	const targetModelName = resolveRelationModelName(relation.toModel);
	const targetSpec = allSpecs.get(targetModelName);
	if (!targetSpec) throw new Error(`Relation "${currentSpec.modelName}.${relationName}" references unknown model "${targetModelName}"`);
	const throughModelName = resolveRelationModelName(relation.through);
	const throughSpec = allSpecs.get(throughModelName);
	if (!throughSpec) throw new Error(`Relation "${currentSpec.modelName}.${relationName}" references unknown through model "${throughModelName}"`);
	const currentAnchorFields = resolveRelationAnchorFields(currentSpec);
	const targetAnchorFields = resolveRelationAnchorFields(targetSpec);
	const throughFromFields = normalizeRelationFieldNames(relation.from);
	const throughToFields = normalizeRelationFieldNames(relation.to);
	if (currentAnchorFields.length !== throughFromFields.length || targetAnchorFields.length !== throughToFields.length) throw new Error(`Relation "${currentSpec.modelName}.${relationName}" has mismatched many-to-many field counts.`);
	return {
		fieldName: relationName,
		toModel: targetModelName,
		toTable: targetSpec.tableName,
		cardinality: "N:M",
		through: {
			table: throughSpec.tableName,
			parentColumns: mapFieldNamesToColumnNames(throughSpec.modelName, throughFromFields, throughSpec.fieldToColumn),
			childColumns: mapFieldNamesToColumnNames(throughSpec.modelName, throughToFields, throughSpec.fieldToColumn)
		},
		on: {
			parentTable: currentSpec.tableName,
			parentColumns: mapFieldNamesToColumnNames(currentSpec.modelName, currentAnchorFields, currentSpec.fieldToColumn),
			childTable: throughSpec.tableName,
			childColumns: mapFieldNamesToColumnNames(throughSpec.modelName, throughFromFields, throughSpec.fieldToColumn)
		}
	};
}
function resolveRelationNode(relationName, relation, currentSpec, allSpecs) {
	if (relation.kind === "belongsTo") return lowerBelongsToRelation(relationName, relation, currentSpec, allSpecs);
	if (relation.kind === "hasMany" || relation.kind === "hasOne") return lowerHasOwnershipRelation(relationName, relation, currentSpec, allSpecs);
	return lowerManyToManyRelation(relationName, relation, currentSpec, allSpecs);
}
function lowerForeignKeyNode(spec, targetSpec, foreignKey) {
	return {
		columns: mapFieldNamesToColumnNames(spec.modelName, foreignKey.fields, spec.fieldToColumn),
		references: {
			model: targetSpec.modelName,
			table: targetSpec.tableName,
			columns: mapFieldNamesToColumnNames(targetSpec.modelName, foreignKey.targetFields, targetSpec.fieldToColumn)
		},
		...foreignKey.name ? { name: foreignKey.name } : {},
		...foreignKey.onDelete ? { onDelete: foreignKey.onDelete } : {},
		...foreignKey.onUpdate ? { onUpdate: foreignKey.onUpdate } : {},
		...foreignKey.constraint !== void 0 ? { constraint: foreignKey.constraint } : {},
		...foreignKey.index !== void 0 ? { index: foreignKey.index } : {}
	};
}
function resolveForeignKeyNodes(spec, allSpecs) {
	const relationForeignKeys = resolveRelationForeignKeys(spec, allSpecs).map((foreignKey) => {
		const targetSpec = allSpecs.get(foreignKey.targetModel);
		if (!targetSpec) throw new Error(`Foreign key on "${spec.modelName}" references unknown model "${foreignKey.targetModel}"`);
		return lowerForeignKeyNode(spec, targetSpec, foreignKey);
	});
	const sqlForeignKeys = (spec.sqlSpec?.foreignKeys ?? []).map((foreignKey) => {
		const targetSpec = allSpecs.get(foreignKey.targetModel);
		if (!targetSpec) throw new Error(`Foreign key on "${spec.modelName}" references unknown model "${foreignKey.targetModel}"`);
		return lowerForeignKeyNode(spec, targetSpec, foreignKey);
	});
	return [...relationForeignKeys, ...sqlForeignKeys];
}
function resolveModelNode(spec, allSpecs, storageTypes, storageTypeReverseLookup) {
	const fields = [];
	for (const [fieldName, fieldBuilder] of Object.entries(spec.fieldBuilders)) {
		const fieldState = fieldBuilder.build();
		const descriptor = resolveFieldDescriptor(spec.modelName, fieldName, fieldState, storageTypes, storageTypeReverseLookup);
		const columnName = spec.fieldToColumn[fieldName];
		if (!columnName) throw new Error(`Column name resolution failed for "${spec.modelName}.${fieldName}"`);
		fields.push({
			fieldName,
			columnName,
			descriptor,
			nullable: fieldState.nullable,
			...fieldState.default ? { default: fieldState.default } : {},
			...fieldState.executionDefault ? { executionDefault: fieldState.executionDefault } : {}
		});
	}
	const { idConstraint } = spec;
	const uniques = resolveModelUniqueConstraints(spec).map((unique) => ({
		columns: mapFieldNamesToColumnNames(spec.modelName, unique.fields, spec.fieldToColumn),
		...unique.name ? { name: unique.name } : {}
	}));
	const indexes = (spec.sqlSpec?.indexes ?? []).map((index) => ({
		columns: mapFieldNamesToColumnNames(spec.modelName, index.fields, spec.fieldToColumn),
		...index.name ? { name: index.name } : {},
		...index.using ? { using: index.using } : {},
		...index.config ? { config: index.config } : {}
	}));
	const foreignKeys = resolveForeignKeyNodes(spec, allSpecs);
	const relations = Object.entries(spec.relations).map(([relationName, relationBuilder]) => resolveRelationNode(relationName, relationBuilder.build(), spec, allSpecs));
	return {
		modelName: spec.modelName,
		tableName: spec.tableName,
		fields,
		...idConstraint ? { id: {
			columns: mapFieldNamesToColumnNames(spec.modelName, idConstraint.fields, spec.fieldToColumn),
			...idConstraint.name ? { name: idConstraint.name } : {}
		} } : {},
		...uniques.length > 0 ? { uniques } : {},
		...indexes.length > 0 ? { indexes } : {},
		...foreignKeys.length > 0 ? { foreignKeys } : {},
		...relations.length > 0 ? { relations } : {}
	};
}
function collectRuntimeModelSpecs(definition) {
	const storageTypes = { ...definition.types ?? {} };
	const models = { ...definition.models ?? {} };
	emitTypedNamedTypeFallbackWarnings(models, storageTypes);
	const modelSpecs = /* @__PURE__ */ new Map();
	const tableOwners = /* @__PURE__ */ new Map();
	for (const [modelName, modelDefinition] of Object.entries(models)) {
		const tokenModelName = modelDefinition.stageOne.modelName;
		if (tokenModelName && tokenModelName !== modelName) throw new Error(`Model token "${tokenModelName}" must be assigned to models.${tokenModelName}. Received models.${modelName}.`);
		const attributesSpec = modelDefinition.buildAttributesSpec();
		const sqlSpec = modelDefinition.buildSqlSpec();
		const tableName = sqlSpec?.table ?? applyNaming(modelName, definition.naming?.tables);
		const existingModel = tableOwners.get(tableName);
		if (existingModel) throw new Error(`Models "${existingModel}" and "${modelName}" both map to table "${tableName}".`);
		tableOwners.set(tableName, modelName);
		const fieldToColumn = {};
		const columnOwners = /* @__PURE__ */ new Map();
		for (const [fieldName, fieldBuilder] of Object.entries(modelDefinition.stageOne.fields)) {
			const columnName = fieldBuilder.build().columnName ?? applyNaming(fieldName, definition.naming?.columns);
			const existingField = columnOwners.get(columnName);
			if (existingField) throw new Error(`Model "${modelName}" maps both "${existingField}" and "${fieldName}" to column "${columnName}".`);
			columnOwners.set(columnName, fieldName);
			fieldToColumn[fieldName] = columnName;
		}
		const fieldBuilders = modelDefinition.stageOne.fields;
		const idConstraint = resolveModelIdConstraint({
			modelName,
			fieldBuilders,
			attributesSpec
		});
		modelSpecs.set(modelName, {
			modelName,
			tableName,
			fieldBuilders,
			fieldToColumn,
			relations: modelDefinition.stageOne.relations,
			attributesSpec,
			sqlSpec,
			idConstraint
		});
	}
	return {
		storageTypes,
		models,
		modelSpecs
	};
}
function lowerModels(collection) {
	emitTypedCrossModelFallbackWarnings(collection);
	const storageTypeReverseLookup = buildStorageTypeReverseLookup(collection.storageTypes);
	return Array.from(collection.modelSpecs.values()).map((spec) => resolveModelNode(spec, collection.modelSpecs, collection.storageTypes, storageTypeReverseLookup));
}
function buildContractDefinition(definition) {
	const collection = collectRuntimeModelSpecs(definition);
	const models = lowerModels(collection);
	return {
		target: definition.target,
		...definition.extensionPacks ? { extensionPacks: definition.extensionPacks } : {},
		...definition.capabilities ? { capabilities: definition.capabilities } : {},
		...definition.storageHash ? { storageHash: definition.storageHash } : {},
		...definition.foreignKeyDefaults ? { foreignKeyDefaults: definition.foreignKeyDefaults } : {},
		...Object.keys(collection.storageTypes).length > 0 ? { storageTypes: collection.storageTypes } : {},
		models
	};
}

//#endregion
//#region src/contract-builder.ts
function validateTargetPackRef(family, target) {
	if (family.familyId !== "sql") throw new Error(`defineContract only accepts SQL family packs. Received family "${family.familyId}".`);
	if (target.familyId !== family.familyId) throw new Error(`target pack "${target.id}" targets family "${target.familyId}" but contract family is "${family.familyId}".`);
}
function validateExtensionPackRefs(target, extensionPacks) {
	if (!extensionPacks) return;
	for (const packRef of Object.values(extensionPacks)) {
		if (packRef.kind !== "extension") throw new Error(`defineContract only accepts extension pack refs in extensionPacks. Received kind "${packRef.kind}".`);
		if (packRef.familyId !== target.familyId) throw new Error(`extension pack "${packRef.id}" targets family "${packRef.familyId}" but contract target family is "${target.familyId}".`);
		if (packRef.targetId && packRef.targetId !== target.targetId) throw new Error(`extension pack "${packRef.id}" targets "${packRef.targetId}" but contract target is "${target.targetId}".`);
	}
}
function buildContractFromDsl(definition) {
	validateTargetPackRef(definition.family, definition.target);
	validateExtensionPackRefs(definition.target, definition.extensionPacks);
	return buildSqlContractFromDefinition(buildContractDefinition(definition), definition.codecLookup);
}
function defineContract(definition, factory) {
	if (!isContractInput(definition)) throw new TypeError("defineContract expects a contract definition object. Define your contract with defineContract({ family, target, models, ... }).");
	if (!factory) return buildContractFromDsl(definition);
	return buildContractFromDsl({
		...definition,
		...factory(createComposedAuthoringHelpers({
			family: definition.family,
			target: definition.target,
			extensionPacks: definition.extensionPacks
		}))
	});
}

//#endregion
export { buildSqlContractFromDefinition, defineContract, field, model, rel };
//# sourceMappingURL=contract-builder.mjs.map