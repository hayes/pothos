import { n as sqlFamilyAuthoringFieldPresets, t as sqlFamilyAuthoringTypes } from "./authoring-type-constructors-BAR65pSK.mjs";
import { c as extractCodecControlHooks, o as collectInitDependencies, s as isDatabaseDependencyProvider, t as verifySqlSchema } from "./verify-sql-schema-Ovz7RXR5.mjs";
import { t as collectSupportedCodecTypeIds } from "./verify-BdES8wgQ.mjs";
import { sqlEmission } from "@prisma-next/sql-contract-emitter";
import { emptyCodecLookup } from "@prisma-next/framework-components/codec";
import { SchemaTreeNode, VERIFY_CODE_HASH_MISMATCH, VERIFY_CODE_MARKER_MISSING, VERIFY_CODE_TARGET_MISMATCH, assembleAuthoringContributions } from "@prisma-next/framework-components/control";
import { validateContract } from "@prisma-next/sql-contract/validate";
import { ensureSchemaStatement, ensureTableStatement, writeContractMarker } from "@prisma-next/sql-runtime";
import { defaultIndexName } from "@prisma-next/sql-schema-ir/naming";
import { ifDefined } from "@prisma-next/utils/defined";
import { notOk, ok } from "@prisma-next/utils/result";

//#region src/core/operation-preview.ts
function isDdlStatement(sqlStatement) {
	const trimmed = sqlStatement.trim().toLowerCase();
	return trimmed.startsWith("create ") || trimmed.startsWith("alter ") || trimmed.startsWith("drop ");
}
function hasExecuteSteps(operation) {
	const candidate = operation;
	if (!("execute" in candidate) || !Array.isArray(candidate["execute"])) return false;
	return candidate["execute"].every((step) => typeof step === "object" && step !== null && "sql" in step);
}
/**
* Extracts a best-effort SQL DDL preview for CLI plan output.
* Presentation-only: never used to decide migration correctness.
*/
function extractSqlDdl(operations) {
	const statements = [];
	for (const operation of operations) {
		if (!hasExecuteSteps(operation)) continue;
		for (const step of operation.execute) if (typeof step.sql === "string" && isDdlStatement(step.sql)) statements.push(step.sql.trim());
	}
	return statements;
}
/**
* Wraps `extractSqlDdl` into the family-agnostic `OperationPreview` shape.
* Each statement carries `language: 'sql'`.
*/
function sqlOperationsToPreview(operations) {
	return { statements: extractSqlDdl(operations).map((text) => ({
		text,
		language: "sql"
	})) };
}

//#endregion
//#region src/core/psl-contract-infer/default-mapping.ts
const DEFAULT_FUNCTION_ATTRIBUTES = {
	"autoincrement()": "@default(autoincrement())",
	"now()": "@default(now())"
};
function mapDefault(columnDefault, options) {
	switch (columnDefault.kind) {
		case "literal": return { attribute: `@default(${formatLiteralValue(columnDefault.value)})` };
		case "function": {
			const attribute = options?.functionAttributes?.[columnDefault.expression] ?? DEFAULT_FUNCTION_ATTRIBUTES[columnDefault.expression] ?? options?.fallbackFunctionAttribute?.(columnDefault.expression);
			return attribute ? { attribute } : { comment: `// Raw default: ${columnDefault.expression.replace(/[\r\n]+/g, " ")}` };
		}
	}
}
function formatLiteralValue(value) {
	if (value === null) return "null";
	switch (typeof value) {
		case "boolean":
		case "number": return String(value);
		case "string": return quoteString(value);
		default: return quoteString(JSON.stringify(value));
	}
}
function quoteString(str) {
	return `"${escapeString(str)}"`;
}
function escapeString(str) {
	return JSON.stringify(str).slice(1, -1);
}

//#endregion
//#region src/core/psl-contract-infer/name-transforms.ts
const PSL_RESERVED_WORDS = new Set([
	"model",
	"enum",
	"types",
	"type",
	"generator",
	"datasource"
]);
const IDENTIFIER_PART_PATTERN = /[A-Za-z0-9]+/g;
function hasSeparators(input) {
	return /[^A-Za-z0-9]/.test(input);
}
function extractIdentifierParts(input) {
	return input.match(IDENTIFIER_PART_PATTERN) ?? [];
}
function createSyntheticIdentifier(input) {
	let hash = 2166136261;
	for (const char of input) {
		hash ^= char.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619);
	}
	return `x${(hash >>> 0).toString(16)}`;
}
function sanitizeIdentifierCharacters(input) {
	const sanitized = input.replace(/[^\w]/g, "");
	return sanitized.length > 0 ? sanitized : createSyntheticIdentifier(input);
}
function capitalize(word) {
	return word.charAt(0).toUpperCase() + word.slice(1);
}
function snakeToPascalCase(input) {
	const parts = extractIdentifierParts(input);
	if (parts.length === 0) return capitalize(sanitizeIdentifierCharacters(input));
	return parts.map(capitalize).join("");
}
function snakeToCamelCase(input) {
	const parts = extractIdentifierParts(input);
	if (parts.length === 0) return sanitizeIdentifierCharacters(input);
	const [firstPart = input, ...rest] = parts;
	return firstPart.charAt(0).toLowerCase() + firstPart.slice(1) + rest.map(capitalize).join("");
}
function needsEscaping(name) {
	return PSL_RESERVED_WORDS.has(name.toLowerCase()) || /^\d/.test(name);
}
function escapeName(name) {
	return `_${name}`;
}
function escapeIfNeeded(name) {
	return needsEscaping(name) ? escapeName(name) : name;
}
function toModelName(tableName) {
	let name;
	if (hasSeparators(tableName)) name = snakeToPascalCase(tableName);
	else name = tableName.charAt(0).toUpperCase() + tableName.slice(1);
	if (needsEscaping(name)) return {
		name: escapeName(name),
		map: tableName
	};
	if (name !== tableName) return {
		name,
		map: tableName
	};
	return { name };
}
function toFieldName(columnName) {
	let name;
	if (hasSeparators(columnName)) name = snakeToCamelCase(columnName);
	else name = columnName.charAt(0).toLowerCase() + columnName.slice(1);
	if (needsEscaping(name)) return {
		name: escapeName(name),
		map: columnName
	};
	if (name !== columnName) return {
		name,
		map: columnName
	};
	return { name };
}
function toEnumName(pgTypeName) {
	let name;
	if (hasSeparators(pgTypeName)) name = snakeToPascalCase(pgTypeName);
	else name = pgTypeName.charAt(0).toUpperCase() + pgTypeName.slice(1);
	if (needsEscaping(name)) return {
		name: escapeName(name),
		map: pgTypeName
	};
	if (name !== pgTypeName) return {
		name,
		map: pgTypeName
	};
	return { name };
}
function pluralize(word) {
	if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z") || word.endsWith("ch") || word.endsWith("sh")) return `${word}es`;
	if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
	return `${word}s`;
}
function deriveRelationFieldName(fkColumns, referencedTableName) {
	if (fkColumns.length === 1) {
		const [col = referencedTableName] = fkColumns;
		const stripped = col.replace(/_id$/i, "").replace(/Id$/, "");
		if (stripped.length > 0 && stripped !== col) return escapeIfNeeded(snakeToCamelCase(stripped));
		return escapeIfNeeded(snakeToCamelCase(referencedTableName));
	}
	return escapeIfNeeded(snakeToCamelCase(referencedTableName));
}
function deriveBackRelationFieldName(childModelName, isOneToOne) {
	const base = childModelName.charAt(0).toLowerCase() + childModelName.slice(1);
	return isOneToOne ? base : pluralize(base);
}
function toNamedTypeName(columnName) {
	let name;
	if (hasSeparators(columnName)) name = snakeToPascalCase(columnName);
	else name = columnName.charAt(0).toUpperCase() + columnName.slice(1);
	return escapeIfNeeded(name);
}

//#endregion
//#region src/core/psl-contract-infer/postgres-default-mapping.ts
const POSTGRES_FUNCTION_ATTRIBUTES = { "gen_random_uuid()": "@default(dbgenerated(\"gen_random_uuid()\"))" };
function formatDbGeneratedAttribute(expression) {
	return `@default(dbgenerated(${JSON.stringify(expression)}))`;
}
function createPostgresDefaultMapping() {
	return {
		functionAttributes: POSTGRES_FUNCTION_ATTRIBUTES,
		fallbackFunctionAttribute: formatDbGeneratedAttribute
	};
}

//#endregion
//#region src/core/psl-contract-infer/postgres-type-map.ts
const POSTGRES_TO_PSL = {
	text: "String",
	bool: "Boolean",
	boolean: "Boolean",
	int4: "Int",
	integer: "Int",
	int8: "BigInt",
	bigint: "BigInt",
	float8: "Float",
	"double precision": "Float",
	numeric: "Decimal",
	decimal: "Decimal",
	timestamptz: "DateTime",
	"timestamp with time zone": "DateTime",
	jsonb: "Json",
	bytea: "Bytes"
};
const PRESERVED_NATIVE_TYPES = {
	"character varying": {
		pslType: "String",
		attributeName: "db.VarChar"
	},
	character: {
		pslType: "String",
		attributeName: "db.Char"
	},
	char: {
		pslType: "String",
		attributeName: "db.Char"
	},
	varchar: {
		pslType: "String",
		attributeName: "db.VarChar"
	},
	uuid: {
		pslType: "String",
		attributeName: "db.Uuid"
	},
	int2: {
		pslType: "Int",
		attributeName: "db.SmallInt"
	},
	smallint: {
		pslType: "Int",
		attributeName: "db.SmallInt"
	},
	float4: {
		pslType: "Float",
		attributeName: "db.Real"
	},
	real: {
		pslType: "Float",
		attributeName: "db.Real"
	},
	timestamp: {
		pslType: "DateTime",
		attributeName: "db.Timestamp"
	},
	"timestamp without time zone": {
		pslType: "DateTime",
		attributeName: "db.Timestamp"
	},
	date: {
		pslType: "DateTime",
		attributeName: "db.Date"
	},
	time: {
		pslType: "DateTime",
		attributeName: "db.Time"
	},
	"time without time zone": {
		pslType: "DateTime",
		attributeName: "db.Time"
	},
	timetz: {
		pslType: "DateTime",
		attributeName: "db.Timetz"
	},
	"time with time zone": {
		pslType: "DateTime",
		attributeName: "db.Timetz"
	},
	json: {
		pslType: "Json",
		attributeName: "db.Json"
	}
};
const PARAMETERIZED_NATIVE_TYPES = {
	"character varying": {
		pslType: "String",
		attributeName: "db.VarChar"
	},
	character: {
		pslType: "String",
		attributeName: "db.Char"
	},
	char: {
		pslType: "String",
		attributeName: "db.Char"
	},
	varchar: {
		pslType: "String",
		attributeName: "db.VarChar"
	},
	numeric: {
		pslType: "Decimal",
		attributeName: "db.Numeric"
	},
	timestamp: {
		pslType: "DateTime",
		attributeName: "db.Timestamp"
	},
	timestamptz: {
		pslType: "DateTime",
		attributeName: "db.Timestamptz"
	},
	time: {
		pslType: "DateTime",
		attributeName: "db.Time"
	},
	timetz: {
		pslType: "DateTime",
		attributeName: "db.Timetz"
	}
};
const PARAMETERIZED_TYPE_PATTERN = /^(.+?)\((.+)\)$/;
const ENUM_CODEC_ID = "pg/enum@1";
function getOwnMappingValue(map, key) {
	return Object.hasOwn(map, key) ? map[key] : void 0;
}
function getOwnRecordValue(map, key) {
	return Object.hasOwn(map, key) ? map[key] : void 0;
}
function createNativeTypeAttribute(name, args) {
	return args && args.length > 0 ? {
		name,
		args
	} : { name };
}
function splitTypeParameterList(params) {
	return params.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}
function createPostgresTypeMap(enumTypeNames) {
	return { resolve(nativeType) {
		if (enumTypeNames?.has(nativeType)) return {
			pslType: nativeType,
			nativeType
		};
		const paramMatch = nativeType.match(PARAMETERIZED_TYPE_PATTERN);
		if (paramMatch) {
			const [, baseType = nativeType, params = ""] = paramMatch;
			const template = getOwnRecordValue(PARAMETERIZED_NATIVE_TYPES, baseType);
			if (template) return {
				pslType: template.pslType,
				nativeType,
				typeParams: {
					baseType,
					params
				},
				nativeTypeAttribute: createNativeTypeAttribute(template.attributeName, splitTypeParameterList(params))
			};
		}
		const preservedType = getOwnRecordValue(PRESERVED_NATIVE_TYPES, nativeType);
		if (preservedType) return {
			pslType: preservedType.pslType,
			nativeType,
			nativeTypeAttribute: createNativeTypeAttribute(preservedType.attributeName)
		};
		const pslType = getOwnMappingValue(POSTGRES_TO_PSL, nativeType);
		if (pslType) return {
			pslType,
			nativeType
		};
		return {
			unsupported: true,
			nativeType
		};
	} };
}
function extractEnumInfo(annotations) {
	const storageTypes = (annotations?.["pg"])?.["storageTypes"];
	const typeNames = /* @__PURE__ */ new Set();
	const definitions = /* @__PURE__ */ new Map();
	if (storageTypes) {
		for (const [key, typeInstance] of Object.entries(storageTypes)) if (typeInstance.codecId === ENUM_CODEC_ID) {
			typeNames.add(key);
			const values = typeInstance.typeParams?.["values"];
			if (Array.isArray(values)) definitions.set(key, values);
		}
	}
	return {
		typeNames,
		definitions
	};
}

//#endregion
//#region src/core/psl-contract-infer/raw-default-parser.ts
const NEXTVAL_PATTERN = /^nextval\s*\(/i;
const NOW_FUNCTION_PATTERN = /^(now\s*\(\s*\)|CURRENT_TIMESTAMP)$/i;
const CLOCK_TIMESTAMP_PATTERN = /^clock_timestamp\s*\(\s*\)$/i;
const TIMESTAMP_CAST_SUFFIX = /::timestamp(?:tz|\s+(?:with|without)\s+time\s+zone)?$/i;
const TEXT_CAST_SUFFIX = /::text$/i;
const NOW_LITERAL_PATTERN = /^'now'$/i;
const UUID_PATTERN = /^gen_random_uuid\s*\(\s*\)$/i;
const UUID_OSSP_PATTERN = /^uuid_generate_v4\s*\(\s*\)$/i;
const NULL_PATTERN = /^NULL(?:::.+)?$/i;
const TRUE_PATTERN = /^true$/i;
const FALSE_PATTERN = /^false$/i;
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;
const JSON_CAST_SUFFIX = /::jsonb?$/i;
const STRING_LITERAL_PATTERN = /^'((?:[^']|'')*)'(?:::(?:"[^"]+"|[\w\s]+)(?:\(\d+\))?)?$/;
function canonicalizeTimestampDefault(expr) {
	if (NOW_FUNCTION_PATTERN.test(expr)) return "now()";
	if (CLOCK_TIMESTAMP_PATTERN.test(expr)) return "clock_timestamp()";
	if (!TIMESTAMP_CAST_SUFFIX.test(expr)) return void 0;
	let inner = expr.replace(TIMESTAMP_CAST_SUFFIX, "").trim();
	if (inner.startsWith("(") && inner.endsWith(")")) inner = inner.slice(1, -1).trim();
	if (NOW_FUNCTION_PATTERN.test(inner)) return "now()";
	if (CLOCK_TIMESTAMP_PATTERN.test(inner)) return "clock_timestamp()";
	inner = inner.replace(TEXT_CAST_SUFFIX, "").trim();
	if (NOW_LITERAL_PATTERN.test(inner)) return "now()";
}
function parseRawDefault(rawDefault, nativeType) {
	const trimmed = rawDefault.trim();
	const normalizedType = nativeType?.toLowerCase();
	if (NEXTVAL_PATTERN.test(trimmed)) return {
		kind: "function",
		expression: "autoincrement()"
	};
	const canonicalTimestamp = canonicalizeTimestampDefault(trimmed);
	if (canonicalTimestamp) return {
		kind: "function",
		expression: canonicalTimestamp
	};
	if (UUID_PATTERN.test(trimmed) || UUID_OSSP_PATTERN.test(trimmed)) return {
		kind: "function",
		expression: "gen_random_uuid()"
	};
	if (NULL_PATTERN.test(trimmed)) return {
		kind: "literal",
		value: null
	};
	if (TRUE_PATTERN.test(trimmed)) return {
		kind: "literal",
		value: true
	};
	if (FALSE_PATTERN.test(trimmed)) return {
		kind: "literal",
		value: false
	};
	if (NUMERIC_PATTERN.test(trimmed)) return {
		kind: "literal",
		value: Number(trimmed)
	};
	const stringMatch = trimmed.match(STRING_LITERAL_PATTERN);
	if (stringMatch?.[1] !== void 0) {
		const unescaped = stringMatch[1].replace(/''/g, "'");
		if (normalizedType === "json" || normalizedType === "jsonb") {
			if (JSON_CAST_SUFFIX.test(trimmed)) return {
				kind: "function",
				expression: trimmed
			};
			try {
				return {
					kind: "literal",
					value: JSON.parse(unescaped)
				};
			} catch {}
		}
		return {
			kind: "literal",
			value: unescaped
		};
	}
	return {
		kind: "function",
		expression: trimmed
	};
}

//#endregion
//#region src/core/psl-contract-infer/relation-inference.ts
const DEFAULT_ON_DELETE = "noAction";
const DEFAULT_ON_UPDATE = "noAction";
const REFERENTIAL_ACTION_PSL = {
	noAction: "NoAction",
	restrict: "Restrict",
	cascade: "Cascade",
	setNull: "SetNull",
	setDefault: "SetDefault"
};
function inferRelations(tables, modelNameMap) {
	const relationsByTable = /* @__PURE__ */ new Map();
	const fkCountByPair = /* @__PURE__ */ new Map();
	for (const table of Object.values(tables)) for (const fk of table.foreignKeys) {
		const pairKey = `${table.name}→${fk.referencedTable}`;
		fkCountByPair.set(pairKey, (fkCountByPair.get(pairKey) ?? 0) + 1);
	}
	const usedFieldNames = /* @__PURE__ */ new Map();
	for (const table of Object.values(tables)) {
		const names = /* @__PURE__ */ new Set();
		for (const col of Object.values(table.columns)) names.add(col.name);
		usedFieldNames.set(table.name, names);
	}
	for (const table of Object.values(tables)) for (const fk of table.foreignKeys) {
		const childTableName = table.name;
		const parentTableName = fk.referencedTable;
		const childUsed = usedFieldNames.get(childTableName);
		const childModelName = modelNameMap.get(childTableName) ?? childTableName;
		const parentModelName = modelNameMap.get(parentTableName) ?? parentTableName;
		const pairKey = `${childTableName}→${parentTableName}`;
		const isSelfRelation = childTableName === parentTableName;
		const needsRelationName = fkCountByPair.get(pairKey) > 1 || isSelfRelation;
		const isOneToOne = detectOneToOne(fk, table);
		const childRelFieldName = resolveUniqueFieldName(deriveRelationFieldName(fk.columns, parentTableName), childUsed, parentModelName);
		const relationName = needsRelationName ? deriveRelationName(fk, childRelFieldName, parentModelName, isSelfRelation) : void 0;
		addRelationField(relationsByTable, childTableName, buildChildRelationField(childRelFieldName, parentModelName, fk, fk.columns.some((columnName) => table.columns[columnName]?.nullable ?? false), relationName));
		childUsed.add(childRelFieldName);
		const parentUsed = usedFieldNames.get(parentTableName) ?? /* @__PURE__ */ new Set();
		usedFieldNames.set(parentTableName, parentUsed);
		const backRelFieldName = resolveUniqueFieldName(deriveBackRelationFieldName(childModelName, isOneToOne), parentUsed, childModelName);
		addRelationField(relationsByTable, parentTableName, {
			fieldName: backRelFieldName,
			typeName: childModelName,
			optional: isOneToOne,
			list: !isOneToOne,
			relationName
		});
		parentUsed.add(backRelFieldName);
	}
	return { relationsByTable };
}
function detectOneToOne(fk, table) {
	const fkCols = [...fk.columns].sort();
	if (table.primaryKey) {
		const pkCols = [...table.primaryKey.columns].sort();
		if (pkCols.length === fkCols.length && pkCols.every((c, i) => c === fkCols[i])) return true;
	}
	for (const unique of table.uniques) {
		const uniqueCols = [...unique.columns].sort();
		if (uniqueCols.length === fkCols.length && uniqueCols.every((c, i) => c === fkCols[i])) return true;
	}
	return false;
}
function deriveRelationName(fk, childRelationFieldName, parentModelName, isSelfRelation) {
	if (fk.name) return fk.name;
	if (isSelfRelation) return `${childRelationFieldName.charAt(0).toUpperCase() + childRelationFieldName.slice(1)}${pluralize(parentModelName)}`;
	return fk.columns.join("_");
}
function buildChildRelationField(fieldName, parentModelName, fk, optional, relationName) {
	const onDelete = fk.onDelete && fk.onDelete !== DEFAULT_ON_DELETE ? fk.onDelete : void 0;
	const onUpdate = fk.onUpdate && fk.onUpdate !== DEFAULT_ON_UPDATE ? fk.onUpdate : void 0;
	return {
		fieldName,
		typeName: parentModelName,
		referencedTableName: fk.referencedTable,
		optional,
		list: false,
		relationName,
		fkName: fk.name,
		fields: fk.columns,
		references: fk.referencedColumns,
		onDelete: onDelete ? REFERENTIAL_ACTION_PSL[onDelete] : void 0,
		onUpdate: onUpdate ? REFERENTIAL_ACTION_PSL[onUpdate] : void 0
	};
}
function resolveUniqueFieldName(desired, usedNames, fallbackSuffix) {
	if (!usedNames.has(desired)) return desired;
	const withSuffix = `${desired}${fallbackSuffix}`;
	if (!usedNames.has(withSuffix)) return withSuffix;
	let counter = 2;
	while (usedNames.has(`${desired}${counter}`)) counter++;
	return `${desired}${counter}`;
}
function addRelationField(map, tableName, field) {
	const existing = map.get(tableName);
	if (existing) existing.push(field);
	else map.set(tableName, [field]);
}

//#endregion
//#region src/core/psl-contract-infer/sql-schema-ir-to-psl-ast.ts
const SYNTHETIC_SPAN = {
	start: {
		offset: 0,
		line: 1,
		column: 1
	},
	end: {
		offset: 0,
		line: 1,
		column: 1
	}
};
const PSL_SCALAR_TYPE_NAMES = new Set([
	"String",
	"Boolean",
	"Int",
	"BigInt",
	"Float",
	"Decimal",
	"DateTime",
	"Json",
	"Bytes"
]);
/**
* Converts a SQL schema IR into a PSL AST suitable for `printPsl`.
*
* This function owns all SQL-specific concerns: native type mapping (Postgres),
* relation inference from foreign keys, enum extraction, and raw default parsing.
* The output is a fully-formed `PslDocumentAst` with synthetic spans.
*/
function sqlSchemaIrToPslAst(schemaIR) {
	const enumInfo = extractEnumInfo(schemaIR.annotations);
	return buildPslDocumentAst(schemaIR, {
		typeMap: createPostgresTypeMap(enumInfo.typeNames),
		defaultMapping: createPostgresDefaultMapping(),
		enumInfo,
		parseRawDefault
	});
}
function buildPslDocumentAst(schemaIR, options) {
	const { typeMap, defaultMapping, enumInfo, parseRawDefault: rawDefaultParser } = options;
	const { typeNames: enumTypeNames, definitions: enumDefinitions } = enumInfo ?? {
		typeNames: /* @__PURE__ */ new Set(),
		definitions: /* @__PURE__ */ new Map()
	};
	const modelNames = buildTopLevelNameMap(Object.keys(schemaIR.tables), toModelName, "model", "table");
	const enumNames = buildTopLevelNameMap(enumTypeNames, toEnumName, "enum", "enum type");
	assertNoCrossKindNameCollisions(modelNames, enumNames);
	const modelNameMap = new Map([...modelNames].map(([tableName, result]) => [tableName, result.name]));
	const enumNameMap = new Map([...enumNames].map(([pgTypeName, result]) => [pgTypeName, result.name]));
	const reservedNamedTypeNames = createReservedNamedTypeNames(modelNames, enumNames);
	const fieldNamesByTable = buildFieldNamesByTable(schemaIR.tables);
	const { relationsByTable } = inferRelations(schemaIR.tables, modelNameMap);
	const namedTypes = seedNamedTypeRegistry(schemaIR, typeMap, enumNameMap, reservedNamedTypeNames);
	const models = [];
	for (const table of Object.values(schemaIR.tables)) models.push(buildModel(table, typeMap, enumNameMap, fieldNamesByTable, namedTypes, defaultMapping, rawDefaultParser, relationsByTable.get(table.name) ?? []));
	const sortedModels = topologicalSort(models, schemaIR.tables, modelNameMap);
	const enums = [];
	for (const [pgTypeName, values] of enumDefinitions) {
		const enumName = enumNames.get(pgTypeName);
		enums.push(buildEnum(enumName, values));
	}
	enums.sort((a, b) => a.name.localeCompare(b.name));
	const namedTypeEntries = [...namedTypes.entriesByKey.values()].sort((a, b) => a.name.localeCompare(b.name));
	const types = namedTypeEntries.length > 0 ? {
		kind: "types",
		declarations: namedTypeEntries.map(buildNamedTypeDeclaration),
		span: SYNTHETIC_SPAN
	} : void 0;
	return {
		kind: "document",
		sourceId: "<sql-schema-ir>",
		models: sortedModels,
		enums,
		compositeTypes: [],
		...types ? { types } : {},
		span: SYNTHETIC_SPAN
	};
}
function buildModel(table, typeMap, enumNameMap, fieldNamesByTable, namedTypes, defaultMapping, rawDefaultParser, relationFields) {
	const { name: modelName, map: mapName } = toModelName(table.name);
	const fieldNameMap = fieldNamesByTable.get(table.name);
	const pkColumns = new Set(table.primaryKey?.columns ?? []);
	const isSinglePk = pkColumns.size === 1;
	const singlePkConstraintName = isSinglePk ? table.primaryKey?.name : void 0;
	const uniqueColumns = /* @__PURE__ */ new Map();
	for (const unique of table.uniques) if (unique.columns.length === 1) {
		const [columnName = ""] = unique.columns;
		const existingConstraintName = uniqueColumns.get(columnName);
		if (!uniqueColumns.has(columnName) || existingConstraintName === void 0 && unique.name) uniqueColumns.set(columnName, unique.name);
	}
	const fields = [];
	for (const column of Object.values(table.columns)) fields.push(buildScalarField(column, table, typeMap, enumNameMap, fieldNameMap, namedTypes, defaultMapping, rawDefaultParser, pkColumns, isSinglePk, singlePkConstraintName, uniqueColumns));
	const usedFieldNames = new Set(fields.map((field) => field.name));
	for (const rel of relationFields) fields.push(buildRelationField(rel, table.name, fieldNamesByTable, usedFieldNames));
	const modelAttributes = [];
	if (table.primaryKey && table.primaryKey.columns.length > 1) {
		const pkFieldNames = table.primaryKey.columns.map((columnName) => resolveColumnFieldName(fieldNamesByTable, table.name, columnName));
		modelAttributes.push(buildModelConstraintAttribute("id", pkFieldNames, table.primaryKey.name));
	}
	for (const unique of table.uniques) if (unique.columns.length > 1) {
		const uniqueFieldNames = unique.columns.map((columnName) => resolveColumnFieldName(fieldNamesByTable, table.name, columnName));
		modelAttributes.push(buildModelConstraintAttribute("unique", uniqueFieldNames, unique.name));
	}
	for (const index of table.indexes) if (!index.unique) {
		const indexFieldNames = index.columns.map((columnName) => resolveColumnFieldName(fieldNamesByTable, table.name, columnName));
		modelAttributes.push(buildModelConstraintAttribute("index", indexFieldNames, index.name));
	}
	if (mapName) modelAttributes.push(buildMapAttribute("model", mapName));
	const comment = table.primaryKey ? void 0 : "// WARNING: This table has no primary key in the database";
	return {
		kind: "model",
		name: modelName,
		fields,
		attributes: modelAttributes,
		span: SYNTHETIC_SPAN,
		...comment !== void 0 ? { comment } : {}
	};
}
function buildScalarField(column, table, typeMap, enumNameMap, fieldNameMap, namedTypes, defaultMapping, rawDefaultParser, pkColumns, isSinglePk, singlePkConstraintName, uniqueColumns) {
	const resolvedField = fieldNameMap?.get(column.name);
	const fieldName = resolvedField?.fieldName ?? toFieldName(column.name).name;
	const fieldMap = resolvedField?.fieldMap;
	const resolution = typeMap.resolve(column.nativeType, table.annotations);
	if ("unsupported" in resolution) {
		const attrs = [];
		if (fieldMap !== void 0) attrs.push(buildMapAttribute("field", fieldMap));
		return {
			kind: "field",
			name: fieldName,
			typeName: `Unsupported("${escapePslString(resolution.nativeType)}")`,
			optional: column.nullable,
			list: false,
			attributes: attrs,
			span: SYNTHETIC_SPAN
		};
	}
	let typeName = resolution.pslType;
	const enumPslName = enumNameMap.get(column.nativeType);
	if (enumPslName) typeName = enumPslName;
	if (resolution.nativeTypeAttribute && !enumPslName) typeName = resolveNamedTypeName(namedTypes, resolution);
	const attributes = [];
	const isId = isSinglePk && pkColumns.has(column.name);
	if (isId) attributes.push(buildSimpleConstraintFieldAttribute("id", singlePkConstraintName));
	if (column.default !== void 0) {
		const parsed = parseColumnDefault(column.default, column.nativeType, rawDefaultParser);
		if (parsed) {
			const result = mapDefault(parsed, defaultMapping);
			if ("attribute" in result) attributes.push(parseDefaultAttributeString(result.attribute));
		}
	}
	if (uniqueColumns.has(column.name) && !isId) {
		const uniqueConstraintName = uniqueColumns.get(column.name);
		attributes.push(buildSimpleConstraintFieldAttribute("unique", uniqueConstraintName));
	}
	if (fieldMap !== void 0) attributes.push(buildMapAttribute("field", fieldMap));
	return {
		kind: "field",
		name: fieldName,
		typeName,
		optional: column.nullable,
		list: false,
		attributes,
		span: SYNTHETIC_SPAN
	};
}
function buildRelationField(rel, hostTableName, fieldNamesByTable, usedFieldNames) {
	const fieldName = createUniqueFieldName(rel.fieldName, usedFieldNames);
	usedFieldNames.add(fieldName);
	const args = [];
	if (rel.fields && rel.references) {
		if (rel.relationName) args.push(namedArg("name", `"${escapePslString(rel.relationName)}"`));
		args.push(namedArg("fields", `[${rel.fields.map((columnName) => resolveColumnFieldName(fieldNamesByTable, hostTableName, columnName)).join(", ")}]`));
		args.push(namedArg("references", `[${rel.references.map((columnName) => resolveColumnFieldName(fieldNamesByTable, rel.referencedTableName ?? "", columnName)).join(", ")}]`));
		if (rel.onDelete) args.push(namedArg("onDelete", rel.onDelete));
		if (rel.onUpdate) args.push(namedArg("onUpdate", rel.onUpdate));
		if (rel.fkName) args.push(namedArg("map", `"${escapePslString(rel.fkName)}"`));
	} else if (rel.relationName) args.push(namedArg("name", `"${escapePslString(rel.relationName)}"`));
	const attrs = args.length > 0 ? [buildAttribute("field", "relation", args)] : [];
	return {
		kind: "field",
		name: fieldName,
		typeName: rel.typeName,
		optional: rel.optional,
		list: rel.list,
		attributes: attrs,
		span: SYNTHETIC_SPAN
	};
}
function buildModelConstraintAttribute(name, fields, constraintName) {
	const args = [positionalArg(`[${fields.join(", ")}]`)];
	if (constraintName !== void 0) args.push(namedArg("map", `"${escapePslString(constraintName)}"`));
	return buildAttribute("model", name, args);
}
function buildSimpleConstraintFieldAttribute(name, constraintName) {
	if (constraintName === void 0) return buildAttribute("field", name, []);
	return buildAttribute("field", name, [namedArg("map", `"${escapePslString(constraintName)}"`)]);
}
function parseDefaultAttributeString(attributeText) {
	return buildAttribute("field", "default", [positionalArg(attributeText.replace(/^@default\(/, "").replace(/\)$/, ""))]);
}
function buildMapAttribute(target, mapName) {
	return buildAttribute(target, "map", [positionalArg(`"${escapePslString(mapName)}"`)]);
}
function buildAttribute(target, name, args) {
	return {
		kind: "attribute",
		target,
		name,
		args,
		span: SYNTHETIC_SPAN
	};
}
function positionalArg(value) {
	return {
		kind: "positional",
		value,
		span: SYNTHETIC_SPAN
	};
}
function namedArg(name, value) {
	return {
		kind: "named",
		name,
		value,
		span: SYNTHETIC_SPAN
	};
}
function buildEnum(name, values) {
	const attrs = [];
	if (name.map) attrs.push(buildMapAttribute("enum", name.map));
	return {
		kind: "enum",
		name: name.name,
		values: values.map((value) => ({
			kind: "enumValue",
			name: value,
			span: SYNTHETIC_SPAN
		})),
		attributes: attrs,
		span: SYNTHETIC_SPAN
	};
}
function buildNamedTypeDeclaration(entry) {
	const attribute = buildAttribute("namedType", entry.nativeTypeAttribute.name, (entry.nativeTypeAttribute.args ?? []).map(positionalArg));
	return {
		kind: "namedType",
		name: entry.name,
		baseType: entry.baseType,
		attributes: [attribute],
		span: SYNTHETIC_SPAN
	};
}
function escapePslString(value) {
	return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}
/**
* Resolves a `SqlColumnIR.default` value into a normalized {@link ColumnDefault}.
*
* `SqlSchemaIR` types the column default as `string` (a raw database default
* expression). Some legacy fixtures and tests still pass already-normalized
* `ColumnDefault` objects in the same slot, so we accept either shape
* defensively at runtime.
*/
function parseColumnDefault(value, nativeType, rawDefaultParser) {
	if (typeof value === "string") return rawDefaultParser ? rawDefaultParser(value, nativeType) : void 0;
	if (value !== null && typeof value === "object" && "kind" in value) return value;
}
function buildFieldNamesByTable(tables) {
	const fieldNamesByTable = /* @__PURE__ */ new Map();
	for (const table of Object.values(tables)) {
		const assignmentOrder = [...Object.values(table.columns).map((column, index) => {
			const { name, map } = toFieldName(column.name);
			return {
				columnName: column.name,
				desiredFieldName: name,
				fieldMap: map,
				index
			};
		})].sort((left, right) => {
			const mapComparison = Number(left.fieldMap !== void 0) - Number(right.fieldMap !== void 0);
			if (mapComparison !== 0) return mapComparison;
			return left.index - right.index;
		});
		const usedFieldNames = /* @__PURE__ */ new Set();
		const tableFieldNames = /* @__PURE__ */ new Map();
		for (const column of assignmentOrder) {
			const fieldName = createUniqueFieldName(column.desiredFieldName, usedFieldNames);
			usedFieldNames.add(fieldName);
			tableFieldNames.set(column.columnName, {
				fieldName,
				fieldMap: column.fieldMap
			});
		}
		fieldNamesByTable.set(table.name, tableFieldNames);
	}
	return fieldNamesByTable;
}
function resolveColumnFieldName(fieldNamesByTable, tableName, columnName) {
	return fieldNamesByTable.get(tableName)?.get(columnName)?.fieldName ?? toFieldName(columnName).name;
}
function createUniqueFieldName(desiredName, usedFieldNames) {
	if (!usedFieldNames.has(desiredName)) return desiredName;
	let counter = 2;
	while (usedFieldNames.has(`${desiredName}${counter}`)) counter++;
	return `${desiredName}${counter}`;
}
function buildTopLevelNameMap(sources, normalize, kind, sourceKind) {
	const results = /* @__PURE__ */ new Map();
	const normalizedToSources = /* @__PURE__ */ new Map();
	for (const source of sources) {
		const normalized = normalize(source);
		results.set(source, normalized);
		normalizedToSources.set(normalized.name, [...normalizedToSources.get(normalized.name) ?? [], source]);
	}
	const duplicates = [...normalizedToSources.entries()].filter(([, conflictingSources]) => conflictingSources.length > 1);
	if (duplicates.length > 0) {
		const details = duplicates.map(([normalizedName, conflictingSources]) => `- ${kind} "${normalizedName}" from ${sourceKind}s ${conflictingSources.map((source) => `"${source}"`).join(", ")}`);
		throw new Error(`PSL ${kind} name collisions detected:\n${details.join("\n")}`);
	}
	return results;
}
function assertNoCrossKindNameCollisions(modelNames, enumNames) {
	const enumSourceByName = new Map([...enumNames].map(([source, result]) => [result.name, source]));
	const collisions = [...modelNames.entries()].map(([tableName, result]) => {
		const enumSource = enumSourceByName.get(result.name);
		return enumSource ? `- identifier "${result.name}" from table "${tableName}" collides with enum type "${enumSource}"` : void 0;
	}).filter((detail) => detail !== void 0);
	if (collisions.length > 0) throw new Error(`PSL top-level name collisions detected:\n${collisions.join("\n")}`);
}
function createReservedNamedTypeNames(modelNames, enumNames) {
	const reservedNames = new Set(PSL_SCALAR_TYPE_NAMES);
	for (const result of modelNames.values()) reservedNames.add(result.name);
	for (const result of enumNames.values()) reservedNames.add(result.name);
	return reservedNames;
}
function seedNamedTypeRegistry(schemaIR, typeMap, enumNameMap, reservedNames) {
	const seeds = /* @__PURE__ */ new Map();
	for (const tableName of Object.keys(schemaIR.tables).sort()) {
		const table = schemaIR.tables[tableName];
		if (!table) continue;
		for (const columnName of Object.keys(table.columns).sort()) {
			const column = table.columns[columnName];
			if (!column) continue;
			const resolution = typeMap.resolve(column.nativeType, table.annotations);
			if ("unsupported" in resolution || enumNameMap.has(column.nativeType) || !resolution.nativeTypeAttribute) continue;
			const signatureKey = createNamedTypeSignatureKey(resolution);
			if (!seeds.has(signatureKey)) seeds.set(signatureKey, {
				baseType: resolution.pslType,
				desiredName: toNamedTypeName(column.name),
				nativeTypeAttribute: resolution.nativeTypeAttribute
			});
		}
	}
	const registry = {
		entriesByKey: /* @__PURE__ */ new Map(),
		usedNames: new Set(reservedNames)
	};
	const sortedSeeds = [...seeds.entries()].sort((left, right) => {
		const desiredNameComparison = left[1].desiredName.localeCompare(right[1].desiredName);
		if (desiredNameComparison !== 0) return desiredNameComparison;
		return left[0].localeCompare(right[0]);
	});
	for (const [signatureKey, seed] of sortedSeeds) {
		const name = createUniqueFieldName(seed.desiredName, registry.usedNames);
		registry.entriesByKey.set(signatureKey, {
			name,
			baseType: seed.baseType,
			nativeTypeAttribute: seed.nativeTypeAttribute
		});
		registry.usedNames.add(name);
	}
	return registry;
}
function resolveNamedTypeName(registry, resolution) {
	const key = createNamedTypeSignatureKey(resolution);
	const existing = registry.entriesByKey.get(key);
	if (existing) return existing.name;
	throw new Error(`Named type registry was not seeded for native type "${resolution.nativeType}"`);
}
function createNamedTypeSignatureKey(resolution) {
	return JSON.stringify({
		baseType: resolution.pslType,
		nativeTypeAttribute: resolution.nativeTypeAttribute ? {
			name: resolution.nativeTypeAttribute.name,
			args: resolution.nativeTypeAttribute.args ?? null
		} : null
	});
}
function topologicalSort(models, tables, modelNameMap) {
	const modelByName = /* @__PURE__ */ new Map();
	for (const model of models) modelByName.set(model.name, model);
	const deps = /* @__PURE__ */ new Map();
	const tableToModel = /* @__PURE__ */ new Map();
	for (const tableName of Object.keys(tables)) {
		const modelName = modelNameMap.get(tableName);
		tableToModel.set(tableName, modelName);
		deps.set(modelName, /* @__PURE__ */ new Set());
	}
	for (const [tableName, table] of Object.entries(tables)) {
		const modelName = tableToModel.get(tableName);
		for (const fk of table.foreignKeys) {
			const refModelName = tableToModel.get(fk.referencedTable);
			if (refModelName && refModelName !== modelName) deps.get(modelName).add(refModelName);
		}
	}
	const result = [];
	const visited = /* @__PURE__ */ new Set();
	const visiting = /* @__PURE__ */ new Set();
	const sortedNames = [...deps.keys()].sort();
	function visit(name) {
		if (visited.has(name)) return;
		if (visiting.has(name)) return;
		visiting.add(name);
		const sortedDeps = [...deps.get(name)].sort();
		for (const dep of sortedDeps) visit(dep);
		visiting.delete(name);
		visited.add(name);
		result.push(modelByName.get(name));
	}
	for (const name of sortedNames) visit(name);
	return result;
}

//#endregion
//#region src/core/control-instance.ts
function extractCodecTypeIdsFromContract(contract) {
	const typeIds = /* @__PURE__ */ new Set();
	if (typeof contract === "object" && contract !== null && "storage" in contract && typeof contract.storage === "object" && contract.storage !== null && "tables" in contract.storage) {
		const storage = contract.storage;
		if (storage.tables && typeof storage.tables === "object") {
			for (const table of Object.values(storage.tables)) if (typeof table === "object" && table !== null && "columns" in table && typeof table.columns === "object" && table.columns !== null) {
				const columns = table.columns;
				for (const column of Object.values(columns)) if (column && typeof column === "object" && "codecId" in column && typeof column.codecId === "string") typeIds.add(column.codecId);
			}
		}
	}
	return Array.from(typeIds).sort();
}
function createVerifyResult(options) {
	const contract = { storageHash: options.contractStorageHash };
	if (options.contractProfileHash) contract.profileHash = options.contractProfileHash;
	const target = { expected: options.expectedTargetId };
	if (options.actualTargetId) target.actual = options.actualTargetId;
	const meta = { contractPath: options.contractPath };
	if (options.configPath) meta.configPath = options.configPath;
	const result = {
		ok: options.ok,
		summary: options.summary,
		contract,
		target,
		meta,
		timings: { total: options.totalTime }
	};
	if (options.code) result.code = options.code;
	if (options.marker) result.marker = {
		storageHash: options.marker.storageHash,
		profileHash: options.marker.profileHash
	};
	if (options.missingCodecs) result.missingCodecs = options.missingCodecs;
	if (options.codecCoverageSkipped) result.codecCoverageSkipped = options.codecCoverageSkipped;
	return result;
}
function isSqlControlAdapter(value) {
	return typeof value === "object" && value !== null && "introspect" in value && typeof value.introspect === "function" && "readMarker" in value && typeof value.readMarker === "function";
}
function buildSqlTypeMetadataRegistry(options) {
	const { target, adapter, extensionPacks: extensions } = options;
	const registry = /* @__PURE__ */ new Map();
	const targetId = adapter.targetId;
	const descriptors = [
		target,
		adapter,
		...extensions
	];
	for (const descriptor of descriptors) {
		const storageTypes = descriptor.types?.storage;
		if (!storageTypes) continue;
		for (const storageType of storageTypes) if (storageType.familyId === "sql" && storageType.targetId === targetId) registry.set(storageType.typeId, {
			typeId: storageType.typeId,
			familyId: "sql",
			targetId: storageType.targetId,
			...storageType.nativeType !== void 0 ? { nativeType: storageType.nativeType } : {}
		});
	}
	return registry;
}
function createSqlFamilyInstance(stack) {
	if (!stack.adapter) throw new Error("SQL family requires an adapter descriptor in ControlStack");
	const target = stack.target;
	const adapter = stack.adapter;
	const extensions = stack.extensionPacks;
	const { codecTypeImports, operationTypeImports, extensionIds } = stack;
	const typeMetadataRegistry = buildSqlTypeMetadataRegistry({
		target,
		adapter,
		extensionPacks: extensions
	});
	const getControlAdapter = () => {
		const controlAdapter = adapter.create(stack);
		if (!isSqlControlAdapter(controlAdapter)) throw new Error("Adapter does not implement SqlControlAdapter (missing introspect or readMarker)");
		return controlAdapter;
	};
	return {
		familyId: "sql",
		codecTypeImports,
		operationTypeImports,
		extensionIds,
		typeMetadataRegistry,
		validateContract(contractJson) {
			return validateContract(contractJson, emptyCodecLookup);
		},
		async verify(verifyOptions) {
			const { driver, contract: rawContract, expectedTargetId, contractPath, configPath } = verifyOptions;
			const startTime = Date.now();
			const contract = validateContract(rawContract, emptyCodecLookup);
			const contractStorageHash = contract.storage.storageHash;
			const contractProfileHash = contract.profileHash;
			const contractTarget = contract.target;
			const marker = await getControlAdapter().readMarker(driver);
			let missingCodecs;
			let codecCoverageSkipped = false;
			const supportedTypeIds = collectSupportedCodecTypeIds([
				adapter,
				target,
				...extensions
			]);
			if (supportedTypeIds.length === 0) codecCoverageSkipped = true;
			else {
				const supportedSet = new Set(supportedTypeIds);
				const missing = extractCodecTypeIdsFromContract(contract).filter((id) => !supportedSet.has(id));
				if (missing.length > 0) missingCodecs = missing;
			}
			if (!marker) return createVerifyResult({
				ok: false,
				code: VERIFY_CODE_MARKER_MISSING,
				summary: "Marker missing",
				contractStorageHash,
				expectedTargetId,
				contractPath,
				totalTime: Date.now() - startTime,
				...contractProfileHash ? { contractProfileHash } : {},
				...missingCodecs ? { missingCodecs } : {},
				...codecCoverageSkipped ? { codecCoverageSkipped } : {},
				...configPath ? { configPath } : {}
			});
			if (contractTarget !== expectedTargetId) return createVerifyResult({
				ok: false,
				code: VERIFY_CODE_TARGET_MISMATCH,
				summary: "Target mismatch",
				contractStorageHash,
				marker,
				expectedTargetId,
				actualTargetId: contractTarget,
				contractPath,
				totalTime: Date.now() - startTime,
				...contractProfileHash ? { contractProfileHash } : {},
				...missingCodecs ? { missingCodecs } : {},
				...codecCoverageSkipped ? { codecCoverageSkipped } : {},
				...configPath ? { configPath } : {}
			});
			if (marker.storageHash !== contractStorageHash) return createVerifyResult({
				ok: false,
				code: VERIFY_CODE_HASH_MISMATCH,
				summary: "Hash mismatch",
				contractStorageHash,
				marker,
				expectedTargetId,
				contractPath,
				totalTime: Date.now() - startTime,
				...contractProfileHash ? { contractProfileHash } : {},
				...missingCodecs ? { missingCodecs } : {},
				...codecCoverageSkipped ? { codecCoverageSkipped } : {},
				...configPath ? { configPath } : {}
			});
			if (contractProfileHash && marker.profileHash !== contractProfileHash) return createVerifyResult({
				ok: false,
				code: VERIFY_CODE_HASH_MISMATCH,
				summary: "Hash mismatch",
				contractStorageHash,
				contractProfileHash,
				marker,
				expectedTargetId,
				contractPath,
				totalTime: Date.now() - startTime,
				...missingCodecs ? { missingCodecs } : {},
				...codecCoverageSkipped ? { codecCoverageSkipped } : {},
				...configPath ? { configPath } : {}
			});
			return createVerifyResult({
				ok: true,
				summary: "Database matches contract",
				contractStorageHash,
				marker,
				expectedTargetId,
				contractPath,
				totalTime: Date.now() - startTime,
				...contractProfileHash ? { contractProfileHash } : {},
				...missingCodecs ? { missingCodecs } : {},
				...codecCoverageSkipped ? { codecCoverageSkipped } : {},
				...configPath ? { configPath } : {}
			});
		},
		async schemaVerify(options) {
			const { driver, contract: contractInput, strict, context, frameworkComponents } = options;
			const contract = validateContract(contractInput, emptyCodecLookup);
			const controlAdapter = getControlAdapter();
			return verifySqlSchema({
				contract,
				schema: await controlAdapter.introspect(driver, contractInput),
				strict,
				...ifDefined("context", context),
				typeMetadataRegistry,
				frameworkComponents,
				...ifDefined("normalizeDefault", controlAdapter.normalizeDefault),
				...ifDefined("normalizeNativeType", controlAdapter.normalizeNativeType)
			});
		},
		async sign(options) {
			const { driver, contract: contractInput, contractPath, configPath } = options;
			const startTime = Date.now();
			const contract = validateContract(contractInput, emptyCodecLookup);
			const contractStorageHash = contract.storage.storageHash;
			const contractProfileHash = "profileHash" in contract && typeof contract.profileHash === "string" ? contract.profileHash : contractStorageHash;
			const contractTarget = contract.target;
			await driver.query(ensureSchemaStatement.sql, ensureSchemaStatement.params);
			await driver.query(ensureTableStatement.sql, ensureTableStatement.params);
			const existingMarker = await getControlAdapter().readMarker(driver);
			let markerCreated = false;
			let markerUpdated = false;
			let previousHashes;
			if (!existingMarker) {
				const write = writeContractMarker({
					storageHash: contractStorageHash,
					profileHash: contractProfileHash,
					contractJson: contractInput,
					canonicalVersion: 1
				});
				await driver.query(write.insert.sql, write.insert.params);
				markerCreated = true;
			} else {
				const existingStorageHash = existingMarker.storageHash;
				const existingProfileHash = existingMarker.profileHash;
				if (!(existingStorageHash === contractStorageHash) || !(existingProfileHash === contractProfileHash)) {
					previousHashes = {
						storageHash: existingStorageHash,
						profileHash: existingProfileHash
					};
					const write = writeContractMarker({
						storageHash: contractStorageHash,
						profileHash: contractProfileHash,
						contractJson: contractInput,
						canonicalVersion: existingMarker.canonicalVersion ?? 1
					});
					await driver.query(write.update.sql, write.update.params);
					markerUpdated = true;
				}
			}
			let summary;
			if (markerCreated) summary = "Database signed (marker created)";
			else if (markerUpdated) summary = `Database signed (marker updated from ${previousHashes?.storageHash ?? "unknown"})`;
			else summary = "Database already signed with this contract";
			const totalTime = Date.now() - startTime;
			return {
				ok: true,
				summary,
				contract: {
					storageHash: contractStorageHash,
					profileHash: contractProfileHash
				},
				target: {
					expected: contractTarget,
					actual: contractTarget
				},
				marker: {
					created: markerCreated,
					updated: markerUpdated,
					...previousHashes ? { previous: previousHashes } : {}
				},
				meta: {
					contractPath,
					...configPath ? { configPath } : {}
				},
				timings: { total: totalTime }
			};
		},
		async readMarker(options) {
			return getControlAdapter().readMarker(options.driver);
		},
		async introspect(options) {
			return getControlAdapter().introspect(options.driver, options.contract);
		},
		inferPslContract(schemaIR) {
			return sqlSchemaIrToPslAst(schemaIR);
		},
		toOperationPreview(operations) {
			return sqlOperationsToPreview(operations);
		},
		toSchemaView(schema) {
			const tableNodes = Object.entries(schema.tables).map(([tableName, table]) => {
				const children = [];
				const columnNodes = [];
				for (const [columnName, column] of Object.entries(table.columns)) {
					const label = `${columnName}: ${column.nativeType} (${column.nullable ? "nullable" : "not nullable"})`;
					columnNodes.push(new SchemaTreeNode({
						kind: "field",
						id: `column-${tableName}-${columnName}`,
						label,
						meta: {
							nativeType: column.nativeType,
							nullable: column.nullable,
							...ifDefined("default", column.default)
						}
					}));
				}
				if (columnNodes.length > 0) children.push(new SchemaTreeNode({
					kind: "collection",
					id: `columns-${tableName}`,
					label: "columns",
					children: columnNodes
				}));
				if (table.primaryKey) {
					const pkColumns = table.primaryKey.columns.join(", ");
					children.push(new SchemaTreeNode({
						kind: "index",
						id: `primary-key-${tableName}`,
						label: `primary key: ${pkColumns}`,
						meta: {
							columns: table.primaryKey.columns,
							...table.primaryKey.name ? { name: table.primaryKey.name } : {}
						}
					}));
				}
				for (const unique of table.uniques) {
					const name = unique.name ?? `${tableName}_${unique.columns.join("_")}_unique`;
					const label = `unique ${name}`;
					children.push(new SchemaTreeNode({
						kind: "index",
						id: `unique-${tableName}-${name}`,
						label,
						meta: {
							columns: unique.columns,
							unique: true
						}
					}));
				}
				for (const index of table.indexes) {
					const name = index.name ?? defaultIndexName(tableName, index.columns);
					const label = index.unique ? `unique index ${name}` : `index ${name}`;
					children.push(new SchemaTreeNode({
						kind: "index",
						id: `index-${tableName}-${name}`,
						label,
						meta: {
							columns: index.columns,
							unique: index.unique
						}
					}));
				}
				const tableMeta = {};
				if (table.primaryKey) {
					tableMeta["primaryKey"] = table.primaryKey.columns;
					if (table.primaryKey.name) tableMeta["primaryKeyName"] = table.primaryKey.name;
				}
				if (table.foreignKeys.length > 0) tableMeta["foreignKeys"] = table.foreignKeys.map((fk) => ({
					columns: fk.columns,
					referencedTable: fk.referencedTable,
					referencedColumns: fk.referencedColumns,
					...fk.name ? { name: fk.name } : {}
				}));
				return new SchemaTreeNode({
					kind: "entity",
					id: `table-${tableName}`,
					label: `table ${tableName}`,
					...Object.keys(tableMeta).length > 0 ? { meta: tableMeta } : {},
					...children.length > 0 ? { children } : {}
				});
			});
			const dependencyNodes = schema.dependencies.map((dep) => {
				const shortName = dep.id.split(".").pop() ?? dep.id;
				return new SchemaTreeNode({
					kind: "dependency",
					id: `dependency-${dep.id}`,
					label: `${shortName} dependency is installed`
				});
			});
			const rootChildren = [...tableNodes, ...dependencyNodes];
			return { root: new SchemaTreeNode({
				kind: "root",
				id: "sql-schema",
				label: "database",
				...rootChildren.length > 0 ? { children: rootChildren } : {}
			}) };
		}
	};
}

//#endregion
//#region src/core/control-descriptor.ts
var SqlFamilyDescriptor = class {
	kind = "family";
	id = "sql";
	familyId = "sql";
	version = "0.0.1";
	emission = sqlEmission;
	authoring = {
		field: sqlFamilyAuthoringFieldPresets,
		type: sqlFamilyAuthoringTypes
	};
	create(stack) {
		return createSqlFamilyInstance(stack);
	}
};

//#endregion
//#region src/core/migrations/contract-to-schema-ir.ts
function convertColumn(name, column, storageTypes, expandNativeType, renderDefault) {
	const resolved = resolveColumnTypeMetadata(column, storageTypes);
	return {
		name,
		nativeType: expandNativeType ? expandNativeType({
			nativeType: resolved.nativeType,
			codecId: resolved.codecId,
			...ifDefined("typeParams", resolved.typeParams)
		}) : resolved.nativeType,
		nullable: column.nullable,
		...ifDefined("default", column.default != null && renderDefault ? renderDefault(column.default, column) : void 0)
	};
}
function resolveColumnTypeMetadata(column, storageTypes) {
	if (!column.typeRef) return column;
	const referenced = storageTypes[column.typeRef];
	if (!referenced) throw new Error(`Column references storage type "${column.typeRef}" but it is not defined in storage.types.`);
	return {
		codecId: referenced.codecId,
		nativeType: referenced.nativeType,
		typeParams: referenced.typeParams
	};
}
function convertUnique(unique) {
	return {
		columns: unique.columns,
		...ifDefined("name", unique.name)
	};
}
function convertIndex(index) {
	return {
		columns: index.columns,
		unique: false,
		...ifDefined("name", index.name)
	};
}
function convertForeignKey(fk) {
	return {
		columns: fk.columns,
		referencedTable: fk.references.table,
		referencedColumns: fk.references.columns,
		...ifDefined("name", fk.name)
	};
}
function convertTable(name, table, storageTypes, expandNativeType, renderDefault) {
	const columns = {};
	for (const [colName, colDef] of Object.entries(table.columns)) columns[colName] = convertColumn(colName, colDef, storageTypes, expandNativeType, renderDefault);
	const satisfiedIndexColumns = new Set([
		...table.indexes.map((idx) => idx.columns.join(",")),
		...table.uniques.map((unique) => unique.columns.join(",")),
		...table.primaryKey ? [table.primaryKey.columns.join(",")] : []
	]);
	const fkBackingIndexes = [];
	for (const fk of table.foreignKeys) {
		if (fk.index === false) continue;
		const key = fk.columns.join(",");
		if (satisfiedIndexColumns.has(key)) continue;
		fkBackingIndexes.push({
			columns: fk.columns,
			unique: false,
			name: defaultIndexName(name, fk.columns)
		});
		satisfiedIndexColumns.add(key);
	}
	return {
		name,
		columns,
		...ifDefined("primaryKey", table.primaryKey),
		foreignKeys: table.foreignKeys.map(convertForeignKey),
		uniques: table.uniques.map(convertUnique),
		indexes: [...table.indexes.map(convertIndex), ...fkBackingIndexes]
	};
}
/**
* Detects destructive changes between two contract storages.
*
* The additive-only planner silently ignores removals (tables, columns).
* This function detects those removals so callers can report them as conflicts
* rather than silently producing an empty plan.
*
* Returns an empty array if no destructive changes are found.
*/
function detectDestructiveChanges(from, to) {
	if (!from) return [];
	const hasOwn = (value, key) => Object.hasOwn(value, key);
	const conflicts = [];
	for (const tableName of Object.keys(from.tables)) {
		if (!hasOwn(to.tables, tableName)) {
			conflicts.push({
				kind: "tableRemoved",
				summary: `Table "${tableName}" was removed`
			});
			continue;
		}
		const toTable = to.tables[tableName];
		const fromTable = from.tables[tableName];
		if (!fromTable) continue;
		for (const columnName of Object.keys(fromTable.columns)) if (!hasOwn(toTable.columns, columnName)) conflicts.push({
			kind: "columnRemoved",
			summary: `Column "${tableName}"."${columnName}" was removed`
		});
	}
	return conflicts;
}
/**
* Converts a `Contract` to `SqlSchemaIR`.
*
* Reads `contract.storage` for tables, `contract.storage.types` for type
* annotations, and derives database dependencies from `frameworkComponents`
* (each component's `databaseDependencies.init[].id`).
* Storage-type annotations are written under `options.annotationNamespace`.
*
* Drops codec metadata (`codecId`, `typeRef`) since the schema IR only represents
* structural information. When `expandNativeType` is provided, parameterized types
* are expanded (e.g. `character` + `{ length: 36 }` → `character(36)`) so the
* resulting IR compares correctly against the "to" contract during planning.
*
* Returns an empty schema IR when `contract` is `null` (new project).
*/
function contractToSchemaIR(contract, options) {
	if (options.annotationNamespace.length === 0) throw new Error("annotationNamespace must be a non-empty string");
	if (!contract) return {
		tables: {},
		dependencies: []
	};
	const storage = contract.storage;
	const storageTypes = storage.types ?? {};
	const tables = {};
	for (const [tableName, tableDef] of Object.entries(storage.tables)) tables[tableName] = convertTable(tableName, tableDef, storageTypes, options.expandNativeType, options.renderDefault);
	return {
		tables,
		dependencies: deduplicateDependencyIRs(collectInitDependencies(options.frameworkComponents ?? [])),
		...ifDefined("annotations", deriveAnnotations(storage, options.annotationNamespace))
	};
}
function deduplicateDependencyIRs(deps) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const dep of deps) {
		if (dep.id.trim().length === 0) throw new Error("Dependency id must be a non-empty string");
		if (seen.has(dep.id)) continue;
		seen.add(dep.id);
		result.push({ id: dep.id });
	}
	return result;
}
function deriveAnnotations(storage, annotationNamespace) {
	if (!storage.types || Object.keys(storage.types).length === 0) return void 0;
	const byNativeType = {};
	for (const typeInstance of Object.values(storage.types)) byNativeType[typeInstance.nativeType] = typeInstance;
	return { [annotationNamespace]: { storageTypes: byNativeType } };
}

//#endregion
//#region src/core/migrations/plan-helpers.ts
const readOnlyEmptyObject = Object.freeze({});
function cloneRecord(value) {
	if (value === readOnlyEmptyObject) return value;
	return Object.freeze({ ...value });
}
function freezeSteps(steps) {
	if (steps.length === 0) return Object.freeze([]);
	return Object.freeze(steps.map((step) => Object.freeze({
		description: step.description,
		sql: step.sql,
		...step.meta ? { meta: cloneRecord(step.meta) } : {}
	})));
}
function freezeDetailsValue(value) {
	if (value === null || value === void 0) return value;
	if (typeof value !== "object") return value;
	if (Array.isArray(value)) return Object.freeze([...value]);
	return Object.freeze({ ...value });
}
function freezeTargetDetails(target) {
	return Object.freeze({
		id: target.id,
		...target.details !== void 0 ? { details: freezeDetailsValue(target.details) } : {}
	});
}
function freezeOperation(operation) {
	return Object.freeze({
		id: operation.id,
		label: operation.label,
		...operation.summary ? { summary: operation.summary } : {},
		operationClass: operation.operationClass,
		target: freezeTargetDetails(operation.target),
		precheck: freezeSteps(operation.precheck),
		execute: freezeSteps(operation.execute),
		postcheck: freezeSteps(operation.postcheck),
		...operation.meta ? { meta: cloneRecord(operation.meta) } : {}
	});
}
function freezeOperations(operations) {
	if (operations.length === 0) return Object.freeze([]);
	return Object.freeze(operations.map((operation) => freezeOperation(operation)));
}
function createMigrationPlan(options) {
	return Object.freeze({
		targetId: options.targetId,
		...options.origin !== void 0 ? { origin: options.origin ? Object.freeze({ ...options.origin }) : null } : {},
		destination: Object.freeze({ ...options.destination }),
		operations: freezeOperations(options.operations),
		providedInvariants: Object.freeze([...options.providedInvariants]),
		...options.meta ? { meta: cloneRecord(options.meta) } : {}
	});
}
function plannerSuccess(plan) {
	return Object.freeze({
		kind: "success",
		plan
	});
}
function plannerFailure(conflicts) {
	return Object.freeze({
		kind: "failure",
		conflicts: Object.freeze(conflicts.map((conflict) => Object.freeze({
			kind: conflict.kind,
			summary: conflict.summary,
			...conflict.why ? { why: conflict.why } : {},
			...conflict.location ? { location: Object.freeze({ ...conflict.location }) } : {},
			...conflict.meta ? { meta: cloneRecord(conflict.meta) } : {}
		})))
	});
}
/**
* Creates a successful migration runner result.
*/
function runnerSuccess(value) {
	return ok(Object.freeze({
		operationsPlanned: value.operationsPlanned,
		operationsExecuted: value.operationsExecuted
	}));
}
/**
* Creates a failed migration runner result.
*/
function runnerFailure(code, summary, options) {
	return notOk(Object.freeze({
		code,
		summary,
		...options?.why ? { why: options.why } : {},
		...options?.meta ? { meta: cloneRecord(options.meta) } : {}
	}));
}

//#endregion
//#region src/core/migrations/policies.ts
/**
* Policy used by `db init`: additive-only operations, no widening/destructive steps.
*/
const INIT_ADDITIVE_POLICY = Object.freeze({ allowedOperationClasses: Object.freeze(["additive"]) });

//#endregion
//#region src/exports/control.ts
var control_default = new SqlFamilyDescriptor();

//#endregion
export { INIT_ADDITIVE_POLICY, assembleAuthoringContributions, collectInitDependencies, contractToSchemaIR, createMigrationPlan, control_default as default, detectDestructiveChanges, extractCodecControlHooks, isDatabaseDependencyProvider, plannerFailure, plannerSuccess, runnerFailure, runnerSuccess };
//# sourceMappingURL=control.mjs.map