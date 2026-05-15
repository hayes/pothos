import { instantiateAuthoringTypeConstructor, isAuthoringTypeConstructorDescriptor, validateAuthoringHelperArguments } from "@prisma-next/framework-components/authoring";
import { buildSqlContractFromDefinition } from "@prisma-next/sql-contract-ts/contract-builder";
import { ifDefined } from "@prisma-next/utils/defined";
import { notOk, ok } from "@prisma-next/utils/result";
import { getPositionalArgument, parseQuotedStringLiteral } from "@prisma-next/psl-parser";
import { assertDefined, invariant } from "@prisma-next/utils/assertions";

//#region src/psl-attribute-parsing.ts
function lowerFirst(value) {
	if (value.length === 0) return value;
	return value[0]?.toLowerCase() + value.slice(1);
}
function getAttribute(attributes, name) {
	return attributes?.find((attribute) => attribute.name === name);
}
function getNamedArgument(attribute, name) {
	const entry = attribute.args.find((arg) => arg.kind === "named" && arg.name === name);
	if (!entry || entry.kind !== "named") return;
	return entry.value;
}
function getPositionalArgumentEntry(attribute, index = 0) {
	const entry = attribute.args.filter((arg) => arg.kind === "positional")[index];
	if (!entry || entry.kind !== "positional") return;
	return {
		value: entry.value,
		span: entry.span
	};
}
function unquoteStringLiteral(value) {
	const trimmed = value.trim();
	const match = trimmed.match(/^(['"])(.*)\1$/);
	if (!match) return trimmed;
	return match[2] ?? "";
}
function parseFieldList(value) {
	const trimmed = value.trim();
	if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return;
	return trimmed.slice(1, -1).split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
function parseMapName(input) {
	if (!input.attribute) return input.defaultValue;
	const value = getPositionalArgument(input.attribute);
	if (!value) {
		input.diagnostics.push({
			code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
			message: `${input.entityLabel} @map requires a positional quoted string literal argument`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return input.defaultValue;
	}
	const parsed = parseQuotedStringLiteral(value);
	if (parsed === void 0) {
		input.diagnostics.push({
			code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
			message: `${input.entityLabel} @map requires a positional quoted string literal argument`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return input.defaultValue;
	}
	return parsed;
}
function parseConstraintMapArgument(input) {
	if (!input.attribute) return;
	const raw = getNamedArgument(input.attribute, "map");
	if (!raw) return;
	const parsed = parseQuotedStringLiteral(raw);
	if (parsed !== void 0) return parsed;
	input.diagnostics.push({
		code: input.code,
		message: `${input.entityLabel} map argument must be a quoted string literal`,
		sourceId: input.sourceId,
		span: input.span
	});
}
function getPositionalArguments(attribute) {
	return attribute.args.filter((arg) => arg.kind === "positional").map((arg) => arg.kind === "positional" ? arg.value : "");
}
function pushInvalidAttributeArgument(input) {
	input.diagnostics.push({
		code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
		message: input.message,
		sourceId: input.sourceId,
		span: input.span
	});
}
function parseOptionalSingleIntegerArgument(input) {
	if (input.attribute.args.some((arg) => arg.kind === "named")) return pushInvalidAttributeArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.attribute.span,
		message: `${input.entityLabel} @${input.attribute.name} accepts zero or one positional integer argument.`
	});
	const positionalArguments = getPositionalArguments(input.attribute);
	if (positionalArguments.length > 1) return pushInvalidAttributeArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.attribute.span,
		message: `${input.entityLabel} @${input.attribute.name} accepts zero or one positional integer argument.`
	});
	if (positionalArguments.length === 0) return null;
	const parsed = Number(unquoteStringLiteral(positionalArguments[0] ?? ""));
	if (!Number.isInteger(parsed) || parsed < input.minimum) return pushInvalidAttributeArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.attribute.span,
		message: `${input.entityLabel} @${input.attribute.name} requires a ${input.valueLabel}.`
	});
	return parsed;
}
function parseOptionalNumericArguments(input) {
	if (input.attribute.args.some((arg) => arg.kind === "named")) return pushInvalidAttributeArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.attribute.span,
		message: `${input.entityLabel} @${input.attribute.name} accepts zero, one, or two positional integer arguments.`
	});
	const positionalArguments = getPositionalArguments(input.attribute);
	if (positionalArguments.length > 2) return pushInvalidAttributeArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.attribute.span,
		message: `${input.entityLabel} @${input.attribute.name} accepts zero, one, or two positional integer arguments.`
	});
	if (positionalArguments.length === 0) return null;
	const precision = Number(unquoteStringLiteral(positionalArguments[0] ?? ""));
	if (!Number.isInteger(precision) || precision < 1) return pushInvalidAttributeArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.attribute.span,
		message: `${input.entityLabel} @${input.attribute.name} requires a positive integer precision.`
	});
	if (positionalArguments.length === 1) return { precision };
	const scale = Number(unquoteStringLiteral(positionalArguments[1] ?? ""));
	if (!Number.isInteger(scale) || scale < 0) return pushInvalidAttributeArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.attribute.span,
		message: `${input.entityLabel} @${input.attribute.name} requires a non-negative integer scale.`
	});
	return {
		precision,
		scale
	};
}
function parseAttributeFieldList(input) {
	const raw = getNamedArgument(input.attribute, "fields") ?? getPositionalArgument(input.attribute);
	if (!raw) {
		input.diagnostics.push({
			code: input.code,
			message: `${input.messagePrefix} requires fields list argument`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return;
	}
	const fields = parseFieldList(raw);
	if (!fields || fields.length === 0) {
		input.diagnostics.push({
			code: input.code,
			message: `${input.messagePrefix} requires bracketed field list argument`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return;
	}
	return fields;
}
function mapFieldNamesToColumns(input) {
	const columns = [];
	for (const fieldName of input.fieldNames) {
		const columnName = input.mapping.fieldColumns.get(fieldName);
		if (!columnName) {
			input.diagnostics.push({
				code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
				message: `${input.contextLabel} references unknown field "${input.modelName}.${fieldName}"`,
				sourceId: input.sourceId,
				span: input.span
			});
			return;
		}
		columns.push(columnName);
	}
	return columns;
}

//#endregion
//#region src/default-function-registry.ts
function resolveSpanPositionFromBase(base, text, offset) {
	const safeOffset = Math.min(Math.max(0, offset), text.length);
	let line = base.start.line;
	let column = base.start.column;
	for (let index = 0; index < safeOffset; index += 1) {
		const character = text[index] ?? "";
		if (character === "\r") {
			if (text[index + 1] === "\n" && index + 1 < safeOffset) index += 1;
			line += 1;
			column = 1;
			continue;
		}
		if (character === "\n") {
			line += 1;
			column = 1;
			continue;
		}
		column += 1;
	}
	return {
		offset: base.start.offset + safeOffset,
		line,
		column
	};
}
function createSpanFromBase(base, startOffset, endOffset, text) {
	const safeStart = Math.max(0, Math.min(startOffset, text.length));
	const safeEnd = Math.max(safeStart, Math.min(endOffset, text.length));
	return {
		start: resolveSpanPositionFromBase(base, text, safeStart),
		end: resolveSpanPositionFromBase(base, text, safeEnd)
	};
}
function splitTopLevelArgs(raw) {
	if (raw.trim().length === 0) return [];
	const parts = [];
	let depthParen = 0;
	let depthBracket = 0;
	let quote = null;
	let start = 0;
	for (let index = 0; index < raw.length; index += 1) {
		const character = raw[index] ?? "";
		if (quote) {
			if (character === quote && raw[index - 1] !== "\\") quote = null;
			continue;
		}
		if (character === "\"" || character === "'") {
			quote = character;
			continue;
		}
		if (character === "(") {
			depthParen += 1;
			continue;
		}
		if (character === ")") {
			depthParen = Math.max(0, depthParen - 1);
			continue;
		}
		if (character === "[") {
			depthBracket += 1;
			continue;
		}
		if (character === "]") {
			depthBracket = Math.max(0, depthBracket - 1);
			continue;
		}
		if (character === "," && depthParen === 0 && depthBracket === 0) {
			parts.push({
				raw: raw.slice(start, index),
				start,
				end: index
			});
			start = index + 1;
		}
	}
	parts.push({
		raw: raw.slice(start),
		start,
		end: raw.length
	});
	return parts;
}
function parseDefaultFunctionCall(expression, expressionSpan) {
	const trimmed = expression.trim();
	const leadingWhitespace = expression.length - expression.trimStart().length;
	const trailingWhitespace = expression.length - expression.trimEnd().length;
	const contentEnd = expression.length - trailingWhitespace;
	const openParen = trimmed.indexOf("(");
	const closeParen = trimmed.lastIndexOf(")");
	if (openParen <= 0 || closeParen !== trimmed.length - 1) return;
	const functionName = trimmed.slice(0, openParen).trim();
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(functionName)) return;
	const parts = splitTopLevelArgs(trimmed.slice(openParen + 1, closeParen));
	const args = [];
	for (const part of parts) {
		const raw = part.raw.trim();
		if (raw.length === 0) return;
		const leadingPartWhitespace = part.raw.length - part.raw.trimStart().length;
		const argStart = leadingWhitespace + openParen + 1 + part.start + leadingPartWhitespace;
		const argEnd = argStart + raw.length;
		args.push({
			raw,
			span: createSpanFromBase(expressionSpan, argStart, argEnd, expression)
		});
	}
	return {
		name: functionName,
		raw: trimmed,
		args,
		span: createSpanFromBase(expressionSpan, leadingWhitespace, contentEnd, expression)
	};
}
function formatSupportedFunctionList(registry) {
	const signatures = Array.from(registry.entries()).sort(([a], [b]) => a.localeCompare(b)).flatMap(([functionName, entry]) => {
		const usageSignatures = entry.usageSignatures?.filter((signature) => signature.length > 0);
		return usageSignatures && usageSignatures.length > 0 ? usageSignatures : [`${functionName}()`];
	});
	return signatures.length > 0 ? signatures.join(", ") : "none";
}
function lowerDefaultFunctionWithRegistry(input) {
	const entry = input.registry.get(input.call.name);
	if (entry) return entry.lower({
		call: input.call,
		context: input.context
	});
	const supportedFunctionList = formatSupportedFunctionList(input.registry);
	return {
		ok: false,
		diagnostic: {
			code: "PSL_UNKNOWN_DEFAULT_FUNCTION",
			message: `Default function "${input.call.name}" is not supported in SQL PSL provider v1. Supported functions: ${supportedFunctionList}.`,
			sourceId: input.context.sourceId,
			span: input.call.span
		}
	};
}

//#endregion
//#region src/psl-authoring-arguments.ts
const INVALID_AUTHORING_ARGUMENT = Symbol("invalidAuthoringArgument");
function isIdentifierStartCharacter(character) {
	return character !== void 0 && /[A-Za-z_$]/.test(character);
}
function isIdentifierCharacter(character) {
	return character !== void 0 && /[A-Za-z0-9_$]/.test(character);
}
function parseJsLikeLiteral(value) {
	let index = 0;
	function skipWhitespace() {
		while (/\s/.test(value[index] ?? "")) index += 1;
	}
	function parseIdentifier() {
		const first = value[index];
		if (!isIdentifierStartCharacter(first)) return INVALID_AUTHORING_ARGUMENT;
		let end = index + 1;
		while (isIdentifierCharacter(value[end])) end += 1;
		const identifier = value.slice(index, end);
		index = end;
		return identifier;
	}
	function parseString() {
		const quote = value[index];
		if (quote !== "\"" && quote !== "'") return INVALID_AUTHORING_ARGUMENT;
		index += 1;
		let result = "";
		while (index < value.length) {
			const character = value[index];
			index += 1;
			if (character === void 0) return INVALID_AUTHORING_ARGUMENT;
			if (character === quote) return result;
			if (character !== "\\") {
				result += character;
				continue;
			}
			const escaped = value[index];
			index += 1;
			if (escaped === void 0) return INVALID_AUTHORING_ARGUMENT;
			switch (escaped) {
				case "'":
				case "\"":
				case "\\":
				case "/":
					result += escaped;
					break;
				case "b":
					result += "\b";
					break;
				case "f":
					result += "\f";
					break;
				case "n":
					result += "\n";
					break;
				case "r":
					result += "\r";
					break;
				case "t":
					result += "	";
					break;
				case "u": {
					const hex = value.slice(index, index + 4);
					if (!/^[0-9A-Fa-f]{4}$/.test(hex)) return INVALID_AUTHORING_ARGUMENT;
					result += String.fromCharCode(Number.parseInt(hex, 16));
					index += 4;
					break;
				}
				default: return INVALID_AUTHORING_ARGUMENT;
			}
		}
		return INVALID_AUTHORING_ARGUMENT;
	}
	function parseNumber() {
		const raw = value.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)?.[0];
		if (!raw) return INVALID_AUTHORING_ARGUMENT;
		const parsed$1 = Number(raw);
		if (!Number.isFinite(parsed$1)) return INVALID_AUTHORING_ARGUMENT;
		index += raw.length;
		return parsed$1;
	}
	function parseArray() {
		if (value[index] !== "[") return INVALID_AUTHORING_ARGUMENT;
		index += 1;
		const result = [];
		skipWhitespace();
		if (value[index] === "]") {
			index += 1;
			return result;
		}
		while (index < value.length) {
			const entry = parseValue();
			if (entry === INVALID_AUTHORING_ARGUMENT) return INVALID_AUTHORING_ARGUMENT;
			result.push(entry);
			skipWhitespace();
			if (value[index] === ",") {
				index += 1;
				skipWhitespace();
				continue;
			}
			if (value[index] === "]") {
				index += 1;
				return result;
			}
			return INVALID_AUTHORING_ARGUMENT;
		}
		return INVALID_AUTHORING_ARGUMENT;
	}
	function parseObject() {
		if (value[index] !== "{") return INVALID_AUTHORING_ARGUMENT;
		index += 1;
		const result = {};
		skipWhitespace();
		if (value[index] === "}") {
			index += 1;
			return result;
		}
		while (index < value.length) {
			skipWhitespace();
			const key = value[index] === "\"" || value[index] === "'" ? parseString() : parseIdentifier();
			if (key === INVALID_AUTHORING_ARGUMENT) return INVALID_AUTHORING_ARGUMENT;
			skipWhitespace();
			if (value[index] !== ":") return INVALID_AUTHORING_ARGUMENT;
			index += 1;
			const entry = parseValue();
			if (entry === INVALID_AUTHORING_ARGUMENT) return INVALID_AUTHORING_ARGUMENT;
			result[key] = entry;
			skipWhitespace();
			if (value[index] === ",") {
				index += 1;
				skipWhitespace();
				continue;
			}
			if (value[index] === "}") {
				index += 1;
				return result;
			}
			return INVALID_AUTHORING_ARGUMENT;
		}
		return INVALID_AUTHORING_ARGUMENT;
	}
	function parseValue() {
		skipWhitespace();
		const character = value[index];
		if (character === "{") return parseObject();
		if (character === "[") return parseArray();
		if (character === "\"" || character === "'") return parseString();
		if (character === "-" || /\d/.test(character ?? "")) return parseNumber();
		const identifier = parseIdentifier();
		if (identifier === INVALID_AUTHORING_ARGUMENT) return INVALID_AUTHORING_ARGUMENT;
		if (identifier === "true") return true;
		if (identifier === "false") return false;
		if (identifier === "null") return null;
		return INVALID_AUTHORING_ARGUMENT;
	}
	skipWhitespace();
	const parsed = parseValue();
	if (parsed === INVALID_AUTHORING_ARGUMENT) return parsed;
	skipWhitespace();
	return index === value.length ? parsed : INVALID_AUTHORING_ARGUMENT;
}
function parseStringArrayLiteral(value) {
	const parsed = parseJsLikeLiteral(value);
	if (parsed === INVALID_AUTHORING_ARGUMENT || !Array.isArray(parsed)) return INVALID_AUTHORING_ARGUMENT;
	if (!parsed.every((item) => typeof item === "string")) return INVALID_AUTHORING_ARGUMENT;
	return parsed;
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parsePslObjectLiteral(value) {
	const trimmed = value.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return INVALID_AUTHORING_ARGUMENT;
	let parsed;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		parsed = parseJsLikeLiteral(trimmed);
		if (parsed === INVALID_AUTHORING_ARGUMENT) return INVALID_AUTHORING_ARGUMENT;
	}
	if (!isPlainObject(parsed)) return INVALID_AUTHORING_ARGUMENT;
	return parsed;
}
function parsePslAuthoringArgumentValue(descriptor, rawValue) {
	switch (descriptor.kind) {
		case "string": return unquoteStringLiteral(rawValue);
		case "number": {
			const parsed = Number(unquoteStringLiteral(rawValue));
			return Number.isNaN(parsed) ? INVALID_AUTHORING_ARGUMENT : parsed;
		}
		case "stringArray": return parseStringArrayLiteral(rawValue);
		case "object": return parsePslObjectLiteral(rawValue);
		default: return INVALID_AUTHORING_ARGUMENT;
	}
}
function pushInvalidPslHelperArgument(input) {
	input.diagnostics.push({
		code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
		message: `${input.entityLabel} ${input.helperLabel} ${input.message}`,
		sourceId: input.sourceId,
		span: input.span
	});
}
function mapPslHelperArgs(input) {
	const mappedArgs = input.descriptors.map(() => void 0);
	const positionalArgs = input.args.filter((arg) => arg.kind === "positional");
	const namedArgs = input.args.filter((arg) => arg.kind === "named");
	if (positionalArgs.length > input.descriptors.length) return pushInvalidPslHelperArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.span,
		entityLabel: input.entityLabel,
		helperLabel: input.helperLabel,
		message: `accepts at most ${input.descriptors.length} argument(s), received ${positionalArgs.length}.`
	});
	for (const [index, argument] of positionalArgs.entries()) {
		const descriptor = input.descriptors[index];
		if (!descriptor) return pushInvalidPslHelperArgument({
			diagnostics: input.diagnostics,
			sourceId: input.sourceId,
			span: argument.span,
			entityLabel: input.entityLabel,
			helperLabel: input.helperLabel,
			message: `does not define positional argument #${index + 1}.`
		});
		const value = parsePslAuthoringArgumentValue(descriptor, argument.value);
		if (value === INVALID_AUTHORING_ARGUMENT) return pushInvalidPslHelperArgument({
			diagnostics: input.diagnostics,
			sourceId: input.sourceId,
			span: argument.span,
			entityLabel: input.entityLabel,
			helperLabel: input.helperLabel,
			message: `cannot parse argument #${index + 1} for descriptor kind "${descriptor.kind}".`
		});
		mappedArgs[index] = value;
	}
	for (const argument of namedArgs) {
		const descriptorIndex = input.descriptors.findIndex((descriptor$1) => descriptor$1.name === argument.name);
		if (descriptorIndex < 0) return pushInvalidPslHelperArgument({
			diagnostics: input.diagnostics,
			sourceId: input.sourceId,
			span: argument.span,
			entityLabel: input.entityLabel,
			helperLabel: input.helperLabel,
			message: `received unknown named argument "${argument.name}".`
		});
		if (mappedArgs[descriptorIndex] !== void 0) return pushInvalidPslHelperArgument({
			diagnostics: input.diagnostics,
			sourceId: input.sourceId,
			span: argument.span,
			entityLabel: input.entityLabel,
			helperLabel: input.helperLabel,
			message: `received duplicate value for argument "${argument.name}".`
		});
		const descriptor = input.descriptors[descriptorIndex];
		if (!descriptor) return pushInvalidPslHelperArgument({
			diagnostics: input.diagnostics,
			sourceId: input.sourceId,
			span: argument.span,
			entityLabel: input.entityLabel,
			helperLabel: input.helperLabel,
			message: `does not define named argument "${argument.name}".`
		});
		const value = parsePslAuthoringArgumentValue(descriptor, argument.value);
		if (value === INVALID_AUTHORING_ARGUMENT) return pushInvalidPslHelperArgument({
			diagnostics: input.diagnostics,
			sourceId: input.sourceId,
			span: argument.span,
			entityLabel: input.entityLabel,
			helperLabel: input.helperLabel,
			message: `cannot parse named argument "${argument.name}" for descriptor kind "${descriptor.kind}".`
		});
		mappedArgs[descriptorIndex] = value;
	}
	return mappedArgs;
}

//#endregion
//#region src/psl-column-resolution.ts
function toNamedTypeFieldDescriptor(typeRef, descriptor) {
	return {
		codecId: descriptor.codecId,
		nativeType: descriptor.nativeType,
		typeRef
	};
}
function getAuthoringTypeConstructor(contributions, path) {
	let current = contributions?.type;
	for (const segment of path) {
		if (typeof current !== "object" || current === null || Array.isArray(current)) return;
		current = current[segment];
	}
	return isAuthoringTypeConstructorDescriptor(current) ? current : void 0;
}
/**
* Returns the namespace prefix of `attributeName` if it references an
* unrecognized extension namespace, otherwise `undefined`. A namespace is
* considered recognized when it is:
*
* - `db` (native-type spec, always allowed),
* - the active family id (e.g. `sql`),
* - the active target id (e.g. `postgres`),
* - present in `composedExtensions`.
*
* Family/target namespaces are exempted so that e.g. `@sql.foo` surfaces as
* PSL_UNSUPPORTED_*_ATTRIBUTE (the attribute isn't defined) rather than
* PSL_EXTENSION_NAMESPACE_NOT_COMPOSED (the namespace is already composed).
*/
function checkUncomposedNamespace(attributeName, composedExtensions, context) {
	const dotIndex = attributeName.indexOf(".");
	if (dotIndex <= 0 || dotIndex === attributeName.length - 1) return;
	const namespace = attributeName.slice(0, dotIndex);
	if (namespace === "db" || namespace === context?.familyId || namespace === context?.targetId || composedExtensions.has(namespace)) return;
	return namespace;
}
/**
* Pushes the canonical `PSL_EXTENSION_NAMESPACE_NOT_COMPOSED` diagnostic for a
* subject (attribute, model attribute, or type constructor) that references an
* extension namespace which is not composed in the current contract.
*
* The `data` payload carries the missing namespace so machine consumers
* (agents, IDE extensions, CLI auto-fix) don't have to parse the prose.
*/
function reportUncomposedNamespace(input) {
	input.diagnostics.push({
		code: "PSL_EXTENSION_NAMESPACE_NOT_COMPOSED",
		message: `${input.subjectLabel} uses unrecognized namespace "${input.namespace}". Add extension pack "${input.namespace}" to extensionPacks in prisma-next.config.ts.`,
		sourceId: input.sourceId,
		span: input.span,
		data: {
			namespace: input.namespace,
			suggestedPack: input.namespace
		}
	});
}
function instantiatePslTypeConstructor(input) {
	const helperPath = input.call.path.join(".");
	const args = mapPslHelperArgs({
		args: input.call.args,
		descriptors: input.descriptor.args ?? [],
		helperLabel: `constructor "${helperPath}"`,
		span: input.call.span,
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		entityLabel: input.entityLabel
	});
	if (!args) return;
	try {
		validateAuthoringHelperArguments(helperPath, input.descriptor.args, args);
		return instantiateAuthoringTypeConstructor(input.descriptor, args);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		input.diagnostics.push({
			code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
			message: `${input.entityLabel} constructor "${helperPath}" ${message}`,
			sourceId: input.sourceId,
			span: input.call.span
		});
		return;
	}
}
function pushUnsupportedTypeConstructorDiagnostic(input) {
	input.diagnostics.push({
		code: input.code,
		message: input.message,
		sourceId: input.sourceId,
		span: input.span
	});
}
function resolvePslTypeConstructorDescriptor(input) {
	const descriptor = getAuthoringTypeConstructor(input.authoringContributions, input.call.path);
	if (descriptor) return descriptor;
	const namespace = input.call.path.length > 1 ? input.call.path[0] : void 0;
	if (namespace && namespace !== "db" && namespace !== input.familyId && namespace !== input.targetId && !input.composedExtensions.has(namespace)) {
		reportUncomposedNamespace({
			subjectLabel: `Type constructor "${input.call.path.join(".")}"`,
			namespace,
			sourceId: input.sourceId,
			span: input.call.span,
			diagnostics: input.diagnostics
		});
		return;
	}
	return pushUnsupportedTypeConstructorDiagnostic({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.call.span,
		code: input.unsupportedCode,
		message: input.unsupportedMessage
	});
}
function resolveFieldTypeDescriptor(input) {
	if (input.field.typeConstructor) {
		const helperPath = input.field.typeConstructor.path.join(".");
		const descriptor$1 = resolvePslTypeConstructorDescriptor({
			call: input.field.typeConstructor,
			authoringContributions: input.authoringContributions,
			composedExtensions: input.composedExtensions,
			familyId: input.familyId,
			targetId: input.targetId,
			diagnostics: input.diagnostics,
			sourceId: input.sourceId,
			unsupportedCode: "PSL_UNSUPPORTED_FIELD_TYPE",
			unsupportedMessage: `${input.entityLabel} type constructor "${helperPath}" is not supported in SQL PSL provider v1`
		});
		if (!descriptor$1) return {
			ok: false,
			alreadyReported: true
		};
		const instantiated = instantiatePslTypeConstructor({
			call: input.field.typeConstructor,
			descriptor: descriptor$1,
			diagnostics: input.diagnostics,
			sourceId: input.sourceId,
			entityLabel: input.entityLabel
		});
		if (!instantiated) return {
			ok: false,
			alreadyReported: true
		};
		return {
			ok: true,
			descriptor: instantiated
		};
	}
	const descriptor = resolveColumnDescriptor(input.field, input.enumTypeDescriptors, input.namedTypeDescriptors, input.scalarTypeDescriptors);
	if (!descriptor) return {
		ok: false,
		alreadyReported: false
	};
	return {
		ok: true,
		descriptor
	};
}
const NATIVE_TYPE_SPECS = {
	"db.VarChar": {
		args: "optionalLength",
		baseType: "String",
		codecId: "sql/varchar@1",
		nativeType: "character varying"
	},
	"db.Char": {
		args: "optionalLength",
		baseType: "String",
		codecId: "sql/char@1",
		nativeType: "character"
	},
	"db.Uuid": {
		args: "noArgs",
		baseType: "String",
		codecId: null,
		nativeType: "uuid"
	},
	"db.SmallInt": {
		args: "noArgs",
		baseType: "Int",
		codecId: "pg/int2@1",
		nativeType: "int2"
	},
	"db.Real": {
		args: "noArgs",
		baseType: "Float",
		codecId: "pg/float4@1",
		nativeType: "float4"
	},
	"db.Numeric": {
		args: "optionalNumeric",
		baseType: "Decimal",
		codecId: "pg/numeric@1",
		nativeType: "numeric"
	},
	"db.Timestamp": {
		args: "optionalPrecision",
		baseType: "DateTime",
		codecId: "pg/timestamp@1",
		nativeType: "timestamp"
	},
	"db.Timestamptz": {
		args: "optionalPrecision",
		baseType: "DateTime",
		codecId: "pg/timestamptz@1",
		nativeType: "timestamptz"
	},
	"db.Date": {
		args: "noArgs",
		baseType: "DateTime",
		codecId: null,
		nativeType: "date"
	},
	"db.Time": {
		args: "optionalPrecision",
		baseType: "DateTime",
		codecId: "pg/time@1",
		nativeType: "time"
	},
	"db.Timetz": {
		args: "optionalPrecision",
		baseType: "DateTime",
		codecId: "pg/timetz@1",
		nativeType: "timetz"
	},
	"db.Json": {
		args: "noArgs",
		baseType: "Json",
		codecId: "pg/json@1",
		nativeType: "json"
	}
};
function resolveDbNativeTypeAttribute(input) {
	const spec = NATIVE_TYPE_SPECS[input.attribute.name];
	if (!spec) {
		input.diagnostics.push({
			code: "PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE",
			message: `${input.entityLabel} uses unsupported attribute "@${input.attribute.name}"`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return;
	}
	if (input.baseType !== spec.baseType) return pushInvalidAttributeArgument({
		diagnostics: input.diagnostics,
		sourceId: input.sourceId,
		span: input.attribute.span,
		message: `${input.entityLabel} uses @${input.attribute.name} on unsupported base type "${input.baseType}". Expected "${spec.baseType}".`
	});
	switch (spec.args) {
		case "noArgs":
			if (getPositionalArguments(input.attribute).length > 0 || input.attribute.args.length > 0) return pushInvalidAttributeArgument({
				diagnostics: input.diagnostics,
				sourceId: input.sourceId,
				span: input.attribute.span,
				message: `${input.entityLabel} @${input.attribute.name} does not accept arguments.`
			});
			return {
				codecId: spec.codecId ?? input.baseDescriptor.codecId,
				nativeType: spec.nativeType
			};
		case "optionalLength": {
			const length = parseOptionalSingleIntegerArgument({
				attribute: input.attribute,
				diagnostics: input.diagnostics,
				sourceId: input.sourceId,
				entityLabel: input.entityLabel,
				minimum: 1,
				valueLabel: "positive integer length"
			});
			if (length === void 0) return;
			return {
				codecId: spec.codecId,
				nativeType: spec.nativeType,
				...length === null ? {} : { typeParams: { length } }
			};
		}
		case "optionalPrecision": {
			const precision = parseOptionalSingleIntegerArgument({
				attribute: input.attribute,
				diagnostics: input.diagnostics,
				sourceId: input.sourceId,
				entityLabel: input.entityLabel,
				minimum: 0,
				valueLabel: "non-negative integer precision"
			});
			if (precision === void 0) return;
			return {
				codecId: spec.codecId,
				nativeType: spec.nativeType,
				...precision === null ? {} : { typeParams: { precision } }
			};
		}
		case "optionalNumeric": {
			const numeric = parseOptionalNumericArguments({
				attribute: input.attribute,
				diagnostics: input.diagnostics,
				sourceId: input.sourceId,
				entityLabel: input.entityLabel
			});
			if (numeric === void 0) return;
			return {
				codecId: spec.codecId,
				nativeType: spec.nativeType,
				...numeric === null ? {} : { typeParams: numeric }
			};
		}
	}
}
function parseDefaultLiteralValue(expression) {
	const trimmed = expression.trim();
	if (trimmed === "true" || trimmed === "false") return {
		kind: "literal",
		value: trimmed === "true"
	};
	const numericValue = Number(trimmed);
	if (!Number.isNaN(numericValue) && trimmed.length > 0 && !/^(['"]).*\1$/.test(trimmed)) return {
		kind: "literal",
		value: numericValue
	};
	if (/^(['"]).*\1$/.test(trimmed)) return {
		kind: "literal",
		value: unquoteStringLiteral(trimmed)
	};
}
function lowerDefaultForField(input) {
	const positionalEntries = input.defaultAttribute.args.filter((arg) => arg.kind === "positional");
	if (input.defaultAttribute.args.filter((arg) => arg.kind === "named").length > 0 || positionalEntries.length !== 1) {
		input.diagnostics.push({
			code: "PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT",
			message: `Field "${input.modelName}.${input.fieldName}" requires exactly one positional @default(...) expression.`,
			sourceId: input.sourceId,
			span: input.defaultAttribute.span
		});
		return {};
	}
	const expressionEntry = getPositionalArgumentEntry(input.defaultAttribute);
	if (!expressionEntry) {
		input.diagnostics.push({
			code: "PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT",
			message: `Field "${input.modelName}.${input.fieldName}" requires a positional @default(...) expression.`,
			sourceId: input.sourceId,
			span: input.defaultAttribute.span
		});
		return {};
	}
	const literalDefault = parseDefaultLiteralValue(expressionEntry.value);
	if (literalDefault) return { defaultValue: literalDefault };
	const defaultFunctionCall = parseDefaultFunctionCall(expressionEntry.value, expressionEntry.span);
	if (!defaultFunctionCall) {
		input.diagnostics.push({
			code: "PSL_INVALID_DEFAULT_VALUE",
			message: `Unsupported default value "${expressionEntry.value}"`,
			sourceId: input.sourceId,
			span: input.defaultAttribute.span
		});
		return {};
	}
	const lowered = lowerDefaultFunctionWithRegistry({
		call: defaultFunctionCall,
		registry: input.defaultFunctionRegistry,
		context: {
			sourceId: input.sourceId,
			modelName: input.modelName,
			fieldName: input.fieldName,
			columnCodecId: input.columnDescriptor.codecId
		}
	});
	if (!lowered.ok) {
		input.diagnostics.push(lowered.diagnostic);
		return {};
	}
	if (lowered.value.kind === "storage") return { defaultValue: lowered.value.defaultValue };
	const generatorDescriptor = input.generatorDescriptorById.get(lowered.value.generated.id);
	if (!generatorDescriptor) {
		input.diagnostics.push({
			code: "PSL_INVALID_DEFAULT_APPLICABILITY",
			message: `Default generator "${lowered.value.generated.id}" is not available in the composed mutation default registry.`,
			sourceId: input.sourceId,
			span: expressionEntry.span
		});
		return {};
	}
	if (!generatorDescriptor.applicableCodecIds.includes(input.columnDescriptor.codecId)) {
		input.diagnostics.push({
			code: "PSL_INVALID_DEFAULT_APPLICABILITY",
			message: `Default generator "${generatorDescriptor.id}" is not applicable to "${input.modelName}.${input.fieldName}" with codecId "${input.columnDescriptor.codecId}".`,
			sourceId: input.sourceId,
			span: expressionEntry.span
		});
		return {};
	}
	return { executionDefault: lowered.value.generated };
}
function resolveColumnDescriptor(field, enumTypeDescriptors, namedTypeDescriptors, scalarTypeDescriptors) {
	if (field.typeRef && namedTypeDescriptors.has(field.typeRef)) return namedTypeDescriptors.get(field.typeRef);
	if (namedTypeDescriptors.has(field.typeName)) return namedTypeDescriptors.get(field.typeName);
	if (enumTypeDescriptors.has(field.typeName)) return enumTypeDescriptors.get(field.typeName);
	return scalarTypeDescriptors.get(field.typeName);
}

//#endregion
//#region src/psl-field-resolution.ts
const BUILTIN_FIELD_ATTRIBUTE_NAMES = new Set([
	"id",
	"unique",
	"default",
	"relation",
	"map"
]);
function validateFieldAttributes(input) {
	for (const attribute of input.field.attributes) {
		if (BUILTIN_FIELD_ATTRIBUTE_NAMES.has(attribute.name)) continue;
		const uncomposedNamespace = checkUncomposedNamespace(attribute.name, input.composedExtensions, {
			familyId: input.familyId,
			targetId: input.targetId
		});
		if (uncomposedNamespace) {
			reportUncomposedNamespace({
				subjectLabel: `Attribute "@${attribute.name}"`,
				namespace: uncomposedNamespace,
				sourceId: input.sourceId,
				span: attribute.span,
				diagnostics: input.diagnostics
			});
			continue;
		}
		input.diagnostics.push({
			code: "PSL_UNSUPPORTED_FIELD_ATTRIBUTE",
			message: `Field "${input.model.name}.${input.field.name}" uses unsupported attribute "@${attribute.name}"`,
			sourceId: input.sourceId,
			span: attribute.span
		});
	}
}
function extractFieldConstraintNames(input) {
	const idAttribute = getAttribute(input.field.attributes, "id");
	const uniqueAttribute = getAttribute(input.field.attributes, "unique");
	return {
		idAttribute,
		uniqueAttribute,
		idName: parseConstraintMapArgument({
			attribute: idAttribute,
			sourceId: input.sourceId,
			diagnostics: input.diagnostics,
			entityLabel: `Field "${input.model.name}.${input.field.name}" @id`,
			span: input.field.span,
			code: "PSL_INVALID_ATTRIBUTE_ARGUMENT"
		}),
		uniqueName: parseConstraintMapArgument({
			attribute: uniqueAttribute,
			sourceId: input.sourceId,
			diagnostics: input.diagnostics,
			entityLabel: `Field "${input.model.name}.${input.field.name}" @unique`,
			span: input.field.span,
			code: "PSL_INVALID_ATTRIBUTE_ARGUMENT"
		})
	};
}
function collectResolvedFields(input) {
	const { model, mapping, enumTypeDescriptors, namedTypeDescriptors, modelNames, compositeTypeNames, composedExtensions, authoringContributions, familyId, targetId, defaultFunctionRegistry, generatorDescriptorById, diagnostics, sourceId, scalarTypeDescriptors } = input;
	const resolvedFields = [];
	for (const field of model.fields) {
		if (field.list && modelNames.has(field.typeName)) continue;
		validateFieldAttributes({
			model,
			field,
			composedExtensions,
			diagnostics,
			sourceId,
			familyId,
			targetId
		});
		if (getAttribute(field.attributes, "relation") && modelNames.has(field.typeName)) continue;
		const isValueObjectField = compositeTypeNames.has(field.typeName);
		const isListField = field.list;
		let descriptor;
		let scalarCodecId;
		const resolveInput = {
			field,
			enumTypeDescriptors,
			namedTypeDescriptors,
			scalarTypeDescriptors,
			authoringContributions,
			composedExtensions,
			familyId,
			targetId,
			diagnostics,
			sourceId,
			entityLabel: `Field "${model.name}.${field.name}"`
		};
		if (isValueObjectField) descriptor = scalarTypeDescriptors.get("Json");
		else if (isListField) {
			const resolved = resolveFieldTypeDescriptor(resolveInput);
			if (!resolved.ok) {
				if (!resolved.alreadyReported) diagnostics.push({
					code: "PSL_UNSUPPORTED_FIELD_TYPE",
					message: `Field "${model.name}.${field.name}" type "${field.typeName}" is not supported in SQL PSL provider v1`,
					sourceId,
					span: field.span
				});
				continue;
			}
			scalarCodecId = resolved.descriptor.codecId;
			descriptor = scalarTypeDescriptors.get("Json");
		} else {
			const resolved = resolveFieldTypeDescriptor(resolveInput);
			if (!resolved.ok) {
				if (!resolved.alreadyReported) diagnostics.push({
					code: "PSL_UNSUPPORTED_FIELD_TYPE",
					message: `Field "${model.name}.${field.name}" type "${field.typeName}" is not supported in SQL PSL provider v1`,
					sourceId,
					span: field.span
				});
				continue;
			}
			descriptor = resolved.descriptor;
		}
		if (!descriptor) continue;
		const defaultAttribute = getAttribute(field.attributes, "default");
		const loweredDefault = defaultAttribute ? lowerDefaultForField({
			modelName: model.name,
			fieldName: field.name,
			defaultAttribute,
			columnDescriptor: descriptor,
			generatorDescriptorById,
			sourceId,
			defaultFunctionRegistry,
			diagnostics
		}) : {};
		if (field.optional && loweredDefault.executionDefault) {
			const generatorDescription = loweredDefault.executionDefault.kind === "generator" ? `"${loweredDefault.executionDefault.id}"` : "for this field";
			diagnostics.push({
				code: "PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT",
				message: `Field "${model.name}.${field.name}" cannot be optional when using execution default ${generatorDescription}. Remove "?" or use a storage default.`,
				sourceId,
				span: defaultAttribute?.span ?? field.span
			});
			continue;
		}
		if (loweredDefault.executionDefault) {
			const generatedDescriptor = generatorDescriptorById.get(loweredDefault.executionDefault.id)?.resolveGeneratedColumnDescriptor?.({ generated: loweredDefault.executionDefault });
			if (generatedDescriptor) descriptor = generatedDescriptor;
		}
		const mappedColumnName = mapping.fieldColumns.get(field.name) ?? field.name;
		const { idAttribute, uniqueAttribute, idName, uniqueName } = extractFieldConstraintNames({
			model,
			field,
			sourceId,
			diagnostics
		});
		resolvedFields.push({
			field,
			columnName: mappedColumnName,
			descriptor,
			...ifDefined("defaultValue", loweredDefault.defaultValue),
			...ifDefined("executionDefault", loweredDefault.executionDefault),
			isId: Boolean(idAttribute),
			isUnique: Boolean(uniqueAttribute),
			...ifDefined("idName", idName),
			...ifDefined("uniqueName", uniqueName),
			...ifDefined("many", isListField ? true : void 0),
			...ifDefined("valueObjectTypeName", isValueObjectField ? field.typeName : void 0),
			...ifDefined("scalarCodecId", scalarCodecId)
		});
	}
	return resolvedFields;
}
function buildModelMappings(models, diagnostics, sourceId) {
	const result = /* @__PURE__ */ new Map();
	for (const model of models) {
		const tableName = parseMapName({
			attribute: getAttribute(model.attributes, "map"),
			defaultValue: lowerFirst(model.name),
			sourceId,
			diagnostics,
			entityLabel: `Model "${model.name}"`,
			span: model.span
		});
		const fieldColumns = /* @__PURE__ */ new Map();
		for (const field of model.fields) {
			const columnName = parseMapName({
				attribute: getAttribute(field.attributes, "map"),
				defaultValue: field.name,
				sourceId,
				diagnostics,
				entityLabel: `Field "${model.name}.${field.name}"`,
				span: field.span
			});
			fieldColumns.set(field.name, columnName);
		}
		result.set(model.name, {
			model,
			tableName,
			fieldColumns
		});
	}
	return result;
}

//#endregion
//#region src/psl-relation-resolution.ts
const REFERENTIAL_ACTION_MAP = {
	NoAction: "noAction",
	Restrict: "restrict",
	Cascade: "cascade",
	SetNull: "setNull",
	SetDefault: "setDefault",
	noAction: "noAction",
	restrict: "restrict",
	cascade: "cascade",
	setNull: "setNull",
	setDefault: "setDefault"
};
function fkRelationPairKey(declaringModelName, targetModelName) {
	return `${declaringModelName}::${targetModelName}`;
}
function normalizeReferentialAction(input) {
	const normalized = REFERENTIAL_ACTION_MAP[input.actionToken];
	if (normalized) return normalized;
	input.diagnostics.push({
		code: "PSL_UNSUPPORTED_REFERENTIAL_ACTION",
		message: `Relation field "${input.modelName}.${input.fieldName}" has unsupported ${input.actionName} action "${input.actionToken}"`,
		sourceId: input.sourceId,
		span: input.span
	});
}
function parseRelationAttribute(input) {
	if (input.attribute.args.filter((arg) => arg.kind === "positional").length > 1) {
		input.diagnostics.push({
			code: "PSL_INVALID_RELATION_ATTRIBUTE",
			message: `Relation field "${input.modelName}.${input.fieldName}" has too many positional arguments`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return;
	}
	let relationNameFromPositional;
	const positionalNameEntry = getPositionalArgumentEntry(input.attribute);
	if (positionalNameEntry) {
		const parsedName = parseQuotedStringLiteral(positionalNameEntry.value);
		if (!parsedName) {
			input.diagnostics.push({
				code: "PSL_INVALID_RELATION_ATTRIBUTE",
				message: `Relation field "${input.modelName}.${input.fieldName}" positional relation name must be a quoted string literal`,
				sourceId: input.sourceId,
				span: positionalNameEntry.span
			});
			return;
		}
		relationNameFromPositional = parsedName;
	}
	for (const arg of input.attribute.args) {
		if (arg.kind === "positional") continue;
		if (arg.name !== "name" && arg.name !== "fields" && arg.name !== "references" && arg.name !== "map" && arg.name !== "onDelete" && arg.name !== "onUpdate") {
			input.diagnostics.push({
				code: "PSL_INVALID_RELATION_ATTRIBUTE",
				message: `Relation field "${input.modelName}.${input.fieldName}" has unsupported argument "${arg.name}"`,
				sourceId: input.sourceId,
				span: arg.span
			});
			return;
		}
	}
	const namedRelationNameRaw = getNamedArgument(input.attribute, "name");
	const namedRelationName = namedRelationNameRaw ? parseQuotedStringLiteral(namedRelationNameRaw) : void 0;
	if (namedRelationNameRaw && !namedRelationName) {
		input.diagnostics.push({
			code: "PSL_INVALID_RELATION_ATTRIBUTE",
			message: `Relation field "${input.modelName}.${input.fieldName}" named relation name must be a quoted string literal`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return;
	}
	if (relationNameFromPositional && namedRelationName && relationNameFromPositional !== namedRelationName) {
		input.diagnostics.push({
			code: "PSL_INVALID_RELATION_ATTRIBUTE",
			message: `Relation field "${input.modelName}.${input.fieldName}" has conflicting positional and named relation names`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return;
	}
	const relationName = namedRelationName ?? relationNameFromPositional;
	const constraintNameRaw = getNamedArgument(input.attribute, "map");
	const constraintName = constraintNameRaw ? parseQuotedStringLiteral(constraintNameRaw) : void 0;
	if (constraintNameRaw && !constraintName) {
		input.diagnostics.push({
			code: "PSL_INVALID_RELATION_ATTRIBUTE",
			message: `Relation field "${input.modelName}.${input.fieldName}" map argument must be a quoted string literal`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return;
	}
	const fieldsRaw = getNamedArgument(input.attribute, "fields");
	const referencesRaw = getNamedArgument(input.attribute, "references");
	if (fieldsRaw && !referencesRaw || !fieldsRaw && referencesRaw) {
		input.diagnostics.push({
			code: "PSL_INVALID_RELATION_ATTRIBUTE",
			message: `Relation field "${input.modelName}.${input.fieldName}" requires fields and references arguments`,
			sourceId: input.sourceId,
			span: input.attribute.span
		});
		return;
	}
	let fields;
	let references;
	if (fieldsRaw && referencesRaw) {
		const parsedFields = parseFieldList(fieldsRaw);
		const parsedReferences = parseFieldList(referencesRaw);
		if (!parsedFields || !parsedReferences || parsedFields.length === 0 || parsedReferences.length === 0) {
			input.diagnostics.push({
				code: "PSL_INVALID_RELATION_ATTRIBUTE",
				message: `Relation field "${input.modelName}.${input.fieldName}" requires bracketed fields and references lists`,
				sourceId: input.sourceId,
				span: input.attribute.span
			});
			return;
		}
		fields = parsedFields;
		references = parsedReferences;
	}
	const onDeleteArgument = getNamedArgument(input.attribute, "onDelete");
	const onUpdateArgument = getNamedArgument(input.attribute, "onUpdate");
	return {
		...ifDefined("relationName", relationName),
		...ifDefined("fields", fields),
		...ifDefined("references", references),
		...ifDefined("constraintName", constraintName),
		...ifDefined("onDelete", onDeleteArgument ? unquoteStringLiteral(onDeleteArgument) : void 0),
		...ifDefined("onUpdate", onUpdateArgument ? unquoteStringLiteral(onUpdateArgument) : void 0)
	};
}
function indexFkRelations(input) {
	const modelRelations = /* @__PURE__ */ new Map();
	const fkRelationsByPair = /* @__PURE__ */ new Map();
	for (const relation of input.fkRelationMetadata) {
		const existing = modelRelations.get(relation.declaringModelName);
		const current = existing ?? [];
		if (!existing) modelRelations.set(relation.declaringModelName, current);
		current.push({
			fieldName: relation.declaringFieldName,
			toModel: relation.targetModelName,
			toTable: relation.targetTableName,
			cardinality: "N:1",
			on: {
				parentTable: relation.declaringTableName,
				parentColumns: relation.localColumns,
				childTable: relation.targetTableName,
				childColumns: relation.referencedColumns
			}
		});
		const pairKey = fkRelationPairKey(relation.declaringModelName, relation.targetModelName);
		const pairRelations = fkRelationsByPair.get(pairKey);
		if (!pairRelations) {
			fkRelationsByPair.set(pairKey, [relation]);
			continue;
		}
		pairRelations.push(relation);
	}
	return {
		modelRelations,
		fkRelationsByPair
	};
}
function applyBackrelationCandidates(input) {
	for (const candidate of input.backrelationCandidates) {
		const pairKey = fkRelationPairKey(candidate.targetModelName, candidate.modelName);
		const pairMatches = input.fkRelationsByPair.get(pairKey) ?? [];
		const matches = candidate.relationName ? pairMatches.filter((relation) => relation.relationName === candidate.relationName) : [...pairMatches];
		if (matches.length === 0) {
			input.diagnostics.push({
				code: "PSL_ORPHANED_BACKRELATION_LIST",
				message: `Backrelation list field "${candidate.modelName}.${candidate.field.name}" has no matching FK-side relation on model "${candidate.targetModelName}". Add @relation(fields: [...], references: [...]) on the FK-side relation or use an explicit join model for many-to-many.`,
				sourceId: input.sourceId,
				span: candidate.field.span
			});
			continue;
		}
		if (matches.length > 1) {
			input.diagnostics.push({
				code: "PSL_AMBIGUOUS_BACKRELATION_LIST",
				message: `Backrelation list field "${candidate.modelName}.${candidate.field.name}" matches multiple FK-side relations on model "${candidate.targetModelName}". Add @relation(name: "...") (or @relation("...")) to both sides to disambiguate.`,
				sourceId: input.sourceId,
				span: candidate.field.span
			});
			continue;
		}
		invariant(matches.length === 1, "Backrelation matching requires exactly one match");
		const matched = matches[0];
		assertDefined(matched, "Backrelation matching requires a defined relation match");
		const existing = input.modelRelations.get(candidate.modelName);
		const current = existing ?? [];
		if (!existing) input.modelRelations.set(candidate.modelName, current);
		current.push({
			fieldName: candidate.field.name,
			toModel: matched.declaringModelName,
			toTable: matched.declaringTableName,
			cardinality: "1:N",
			on: {
				parentTable: candidate.tableName,
				parentColumns: matched.referencedColumns,
				childTable: matched.declaringTableName,
				childColumns: matched.localColumns
			}
		});
	}
}
function validateNavigationListFieldAttributes(input) {
	let valid = true;
	for (const attribute of input.field.attributes) {
		if (attribute.name === "relation") continue;
		const uncomposedNamespace = checkUncomposedNamespace(attribute.name, input.composedExtensions, {
			familyId: input.familyId,
			targetId: input.targetId
		});
		if (uncomposedNamespace) {
			reportUncomposedNamespace({
				subjectLabel: `Attribute "@${attribute.name}"`,
				namespace: uncomposedNamespace,
				sourceId: input.sourceId,
				span: attribute.span,
				diagnostics: input.diagnostics
			});
			valid = false;
			continue;
		}
		input.diagnostics.push({
			code: "PSL_UNSUPPORTED_FIELD_ATTRIBUTE",
			message: `Field "${input.modelName}.${input.field.name}" uses unsupported attribute "@${attribute.name}"`,
			sourceId: input.sourceId,
			span: attribute.span
		});
		valid = false;
	}
	return valid;
}

//#endregion
//#region src/interpreter.ts
function buildComposedExtensionPackRefs(target, extensionIds, extensionPackRefs = []) {
	if (extensionIds.length === 0) return;
	const extensionPackRefById = new Map(extensionPackRefs.map((packRef) => [packRef.id, packRef]));
	return Object.fromEntries(extensionIds.map((extensionId) => [extensionId, extensionPackRefById.get(extensionId) ?? {
		kind: "extension",
		id: extensionId,
		familyId: target.familyId,
		targetId: target.targetId,
		version: "0.0.1"
	}]));
}
function diagnosticDedupKey(diagnostic) {
	const span = diagnostic.span;
	const spanKey = span ? `${span.start.offset}:${span.end.offset}:${span.start.line}:${span.end.line}` : "";
	return `${diagnostic.code}\u0000${diagnostic.sourceId}\u0000${spanKey}\u0000${diagnostic.message}`;
}
function dedupeDiagnostics(diagnostics) {
	const seen = /* @__PURE__ */ new Map();
	for (const diagnostic of diagnostics) {
		const key = diagnosticDedupKey(diagnostic);
		if (!seen.has(key)) seen.set(key, diagnostic);
	}
	return [...seen.values()];
}
function compareStrings(left, right) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
function mapParserDiagnostics(document) {
	return document.diagnostics.map((diagnostic) => ({
		code: diagnostic.code,
		message: diagnostic.message,
		sourceId: diagnostic.sourceId,
		span: diagnostic.span
	}));
}
function processEnumDeclarations(input) {
	const storageTypes = {};
	const enumTypeDescriptors = /* @__PURE__ */ new Map();
	for (const enumDeclaration of input.enums) {
		const nativeType = parseMapName({
			attribute: getAttribute(enumDeclaration.attributes, "map"),
			defaultValue: enumDeclaration.name,
			sourceId: input.sourceId,
			diagnostics: input.diagnostics,
			entityLabel: `Enum "${enumDeclaration.name}"`,
			span: enumDeclaration.span
		});
		const enumStorageType = input.enumTypeConstructor ? instantiateAuthoringTypeConstructor(input.enumTypeConstructor, [nativeType, enumDeclaration.values.map((value) => value.name)]) : {
			codecId: "pg/enum@1",
			nativeType,
			typeParams: { values: enumDeclaration.values.map((value) => value.name) }
		};
		const descriptor = {
			codecId: enumStorageType.codecId,
			nativeType: enumStorageType.nativeType,
			typeRef: enumDeclaration.name
		};
		enumTypeDescriptors.set(enumDeclaration.name, descriptor);
		storageTypes[enumDeclaration.name] = {
			codecId: enumStorageType.codecId,
			nativeType: enumStorageType.nativeType,
			typeParams: enumStorageType.typeParams ?? { values: enumDeclaration.values.map((value) => value.name) }
		};
	}
	return {
		storageTypes,
		enumTypeDescriptors
	};
}
function validateNamedTypeAttributes(input) {
	const [dbNativeTypeAttribute, ...extraDbNativeTypeAttributes] = input.allowDbNativeType ? input.declaration.attributes.filter((attribute) => attribute.name.startsWith("db.")) : [];
	let hasUnsupportedNamedTypeAttribute = false;
	for (const extra of extraDbNativeTypeAttributes) {
		input.diagnostics.push({
			code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
			message: `Named type "${input.declaration.name}" can declare at most one @db.* attribute`,
			sourceId: input.sourceId,
			span: extra.span
		});
		hasUnsupportedNamedTypeAttribute = true;
	}
	for (const attribute of input.declaration.attributes) {
		if (input.allowDbNativeType && attribute.name.startsWith("db.")) continue;
		const uncomposedNamespace = checkUncomposedNamespace(attribute.name, input.composedExtensions, {
			familyId: input.familyId,
			targetId: input.targetId
		});
		if (uncomposedNamespace) {
			reportUncomposedNamespace({
				subjectLabel: `Attribute "@${attribute.name}"`,
				namespace: uncomposedNamespace,
				sourceId: input.sourceId,
				span: attribute.span,
				diagnostics: input.diagnostics
			});
			hasUnsupportedNamedTypeAttribute = true;
			continue;
		}
		input.diagnostics.push({
			code: "PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE",
			message: `Named type "${input.declaration.name}" uses unsupported attribute "${attribute.name}"`,
			sourceId: input.sourceId,
			span: attribute.span
		});
		hasUnsupportedNamedTypeAttribute = true;
	}
	return {
		dbNativeTypeAttribute,
		hasUnsupportedNamedTypeAttribute
	};
}
function resolveNamedTypeDeclarations(input) {
	const storageTypes = {};
	const namedTypeDescriptors = /* @__PURE__ */ new Map();
	for (const declaration of input.declarations) {
		if (declaration.typeConstructor) {
			const { hasUnsupportedNamedTypeAttribute: hasUnsupportedNamedTypeAttribute$1 } = validateNamedTypeAttributes({
				declaration,
				sourceId: input.sourceId,
				diagnostics: input.diagnostics,
				composedExtensions: input.composedExtensions,
				allowDbNativeType: false,
				familyId: input.familyId,
				targetId: input.targetId
			});
			if (hasUnsupportedNamedTypeAttribute$1) continue;
			const helperPath = declaration.typeConstructor.path.join(".");
			const typeConstructor = resolvePslTypeConstructorDescriptor({
				call: declaration.typeConstructor,
				authoringContributions: input.authoringContributions,
				composedExtensions: input.composedExtensions,
				familyId: input.familyId,
				targetId: input.targetId,
				diagnostics: input.diagnostics,
				sourceId: input.sourceId,
				unsupportedCode: "PSL_UNSUPPORTED_NAMED_TYPE_CONSTRUCTOR",
				unsupportedMessage: `Named type "${declaration.name}" references unsupported constructor "${helperPath}"`
			});
			if (!typeConstructor) continue;
			const storageType = instantiatePslTypeConstructor({
				call: declaration.typeConstructor,
				descriptor: typeConstructor,
				diagnostics: input.diagnostics,
				sourceId: input.sourceId,
				entityLabel: `Named type "${declaration.name}"`
			});
			if (!storageType) continue;
			namedTypeDescriptors.set(declaration.name, toNamedTypeFieldDescriptor(declaration.name, storageType));
			storageTypes[declaration.name] = {
				codecId: storageType.codecId,
				nativeType: storageType.nativeType,
				typeParams: storageType.typeParams ?? {}
			};
			continue;
		}
		if (declaration.baseType === void 0) {
			input.diagnostics.push({
				code: "PSL_UNSUPPORTED_NAMED_TYPE_BASE",
				message: `Named type "${declaration.name}" must declare a base type or constructor`,
				sourceId: input.sourceId,
				span: declaration.span
			});
			continue;
		}
		const { baseType } = declaration;
		const baseDescriptor = input.enumTypeDescriptors.get(baseType) ?? input.scalarTypeDescriptors.get(baseType);
		if (!baseDescriptor) {
			input.diagnostics.push({
				code: "PSL_UNSUPPORTED_NAMED_TYPE_BASE",
				message: `Named type "${declaration.name}" references unsupported base type "${baseType}"`,
				sourceId: input.sourceId,
				span: declaration.span
			});
			continue;
		}
		const { dbNativeTypeAttribute, hasUnsupportedNamedTypeAttribute } = validateNamedTypeAttributes({
			declaration,
			sourceId: input.sourceId,
			diagnostics: input.diagnostics,
			composedExtensions: input.composedExtensions,
			allowDbNativeType: true,
			familyId: input.familyId,
			targetId: input.targetId
		});
		if (hasUnsupportedNamedTypeAttribute) continue;
		if (dbNativeTypeAttribute) {
			const descriptor$1 = resolveDbNativeTypeAttribute({
				attribute: dbNativeTypeAttribute,
				baseType,
				baseDescriptor,
				diagnostics: input.diagnostics,
				sourceId: input.sourceId,
				entityLabel: `Named type "${declaration.name}"`
			});
			if (!descriptor$1) continue;
			namedTypeDescriptors.set(declaration.name, toNamedTypeFieldDescriptor(declaration.name, descriptor$1));
			storageTypes[declaration.name] = {
				codecId: descriptor$1.codecId,
				nativeType: descriptor$1.nativeType,
				typeParams: descriptor$1.typeParams ?? {}
			};
			continue;
		}
		const descriptor = toNamedTypeFieldDescriptor(declaration.name, baseDescriptor);
		namedTypeDescriptors.set(declaration.name, descriptor);
		storageTypes[declaration.name] = {
			codecId: baseDescriptor.codecId,
			nativeType: baseDescriptor.nativeType,
			typeParams: {}
		};
	}
	return {
		storageTypes,
		namedTypeDescriptors
	};
}
function buildModelNodeFromPsl(input) {
	const { model, mapping, sourceId, diagnostics } = input;
	const tableName = mapping.tableName;
	const resolvedFields = collectResolvedFields({
		model,
		mapping,
		enumTypeDescriptors: input.enumTypeDescriptors,
		namedTypeDescriptors: input.namedTypeDescriptors,
		modelNames: input.modelNames,
		compositeTypeNames: input.compositeTypeNames,
		composedExtensions: input.composedExtensions,
		authoringContributions: input.authoringContributions,
		familyId: input.familyId,
		targetId: input.targetId,
		defaultFunctionRegistry: input.defaultFunctionRegistry,
		generatorDescriptorById: input.generatorDescriptorById,
		diagnostics,
		sourceId,
		scalarTypeDescriptors: input.scalarTypeDescriptors
	});
	const primaryKeyFields = resolvedFields.filter((field) => field.isId);
	const primaryKeyColumns = primaryKeyFields.map((field) => field.columnName);
	const primaryKeyName = primaryKeyFields.length === 1 ? primaryKeyFields[0]?.idName : void 0;
	const isVariantModel = model.attributes.some((attr) => attr.name === "base");
	if (primaryKeyColumns.length === 0 && !isVariantModel) diagnostics.push({
		code: "PSL_MISSING_PRIMARY_KEY",
		message: `Model "${model.name}" must declare at least one @id field for SQL provider`,
		sourceId,
		span: model.span
	});
	const resultBackrelationCandidates = [];
	for (const field of model.fields) {
		if (!field.list || !input.modelNames.has(field.typeName)) continue;
		const attributesValid = validateNavigationListFieldAttributes({
			modelName: model.name,
			field,
			sourceId,
			composedExtensions: input.composedExtensions,
			diagnostics,
			familyId: input.familyId,
			targetId: input.targetId
		});
		const relationAttribute = getAttribute(field.attributes, "relation");
		let relationName;
		if (relationAttribute) {
			const parsedRelation = parseRelationAttribute({
				attribute: relationAttribute,
				modelName: model.name,
				fieldName: field.name,
				sourceId,
				diagnostics
			});
			if (!parsedRelation) continue;
			if (parsedRelation.fields || parsedRelation.references) {
				diagnostics.push({
					code: "PSL_INVALID_RELATION_ATTRIBUTE",
					message: `Backrelation list field "${model.name}.${field.name}" cannot declare fields/references; define them on the FK-side relation field`,
					sourceId,
					span: relationAttribute.span
				});
				continue;
			}
			if (parsedRelation.onDelete || parsedRelation.onUpdate) {
				diagnostics.push({
					code: "PSL_INVALID_RELATION_ATTRIBUTE",
					message: `Backrelation list field "${model.name}.${field.name}" cannot declare onDelete/onUpdate; define referential actions on the FK-side relation field`,
					sourceId,
					span: relationAttribute.span
				});
				continue;
			}
			relationName = parsedRelation.relationName;
		}
		if (!attributesValid) continue;
		resultBackrelationCandidates.push({
			modelName: model.name,
			tableName,
			field,
			targetModelName: field.typeName,
			...ifDefined("relationName", relationName)
		});
	}
	const relationAttributes = model.fields.map((field) => ({
		field,
		relation: getAttribute(field.attributes, "relation")
	})).filter((entry) => Boolean(entry.relation));
	const uniqueConstraints = resolvedFields.filter((field) => field.isUnique).map((field) => ({
		columns: [field.columnName],
		...ifDefined("name", field.uniqueName)
	}));
	const indexNodes = [];
	const foreignKeyNodes = [];
	for (const modelAttribute of model.attributes) {
		if (modelAttribute.name === "map") continue;
		if (modelAttribute.name === "discriminator" || modelAttribute.name === "base") continue;
		if (modelAttribute.name === "unique" || modelAttribute.name === "index") {
			const fieldNames = parseAttributeFieldList({
				attribute: modelAttribute,
				sourceId,
				diagnostics,
				code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
				messagePrefix: `Model "${model.name}" @@${modelAttribute.name}`
			});
			if (!fieldNames) continue;
			const columnNames = mapFieldNamesToColumns({
				modelName: model.name,
				fieldNames,
				mapping,
				sourceId,
				diagnostics,
				span: modelAttribute.span,
				contextLabel: `Model "${model.name}" @@${modelAttribute.name}`
			});
			if (!columnNames) continue;
			const constraintName = parseConstraintMapArgument({
				attribute: modelAttribute,
				sourceId,
				diagnostics,
				entityLabel: `Model "${model.name}" @@${modelAttribute.name}`,
				span: modelAttribute.span,
				code: "PSL_INVALID_ATTRIBUTE_ARGUMENT"
			});
			if (modelAttribute.name === "unique") uniqueConstraints.push({
				columns: columnNames,
				...ifDefined("name", constraintName)
			});
			else indexNodes.push({
				columns: columnNames,
				...ifDefined("name", constraintName)
			});
			continue;
		}
		const uncomposedNamespace = checkUncomposedNamespace(modelAttribute.name, input.composedExtensions, {
			familyId: input.familyId,
			targetId: input.targetId
		});
		if (uncomposedNamespace) {
			reportUncomposedNamespace({
				subjectLabel: `Attribute "@@${modelAttribute.name}"`,
				namespace: uncomposedNamespace,
				sourceId,
				span: modelAttribute.span,
				diagnostics
			});
			continue;
		}
		diagnostics.push({
			code: "PSL_UNSUPPORTED_MODEL_ATTRIBUTE",
			message: `Model "${model.name}" uses unsupported attribute "@@${modelAttribute.name}"`,
			sourceId,
			span: modelAttribute.span
		});
	}
	const resultFkRelationMetadata = [];
	for (const relationAttribute of relationAttributes) {
		if (relationAttribute.field.list) continue;
		if (!input.modelNames.has(relationAttribute.field.typeName)) {
			diagnostics.push({
				code: "PSL_INVALID_RELATION_TARGET",
				message: `Relation field "${model.name}.${relationAttribute.field.name}" references unknown model "${relationAttribute.field.typeName}"`,
				sourceId,
				span: relationAttribute.field.span
			});
			continue;
		}
		const parsedRelation = parseRelationAttribute({
			attribute: relationAttribute.relation,
			modelName: model.name,
			fieldName: relationAttribute.field.name,
			sourceId,
			diagnostics
		});
		if (!parsedRelation) continue;
		if (!parsedRelation.fields || !parsedRelation.references) {
			diagnostics.push({
				code: "PSL_INVALID_RELATION_ATTRIBUTE",
				message: `Relation field "${model.name}.${relationAttribute.field.name}" requires fields and references arguments`,
				sourceId,
				span: relationAttribute.relation.span
			});
			continue;
		}
		const targetMapping = input.modelMappings.get(relationAttribute.field.typeName);
		if (!targetMapping) {
			diagnostics.push({
				code: "PSL_INVALID_RELATION_TARGET",
				message: `Relation field "${model.name}.${relationAttribute.field.name}" references unknown model "${relationAttribute.field.typeName}"`,
				sourceId,
				span: relationAttribute.field.span
			});
			continue;
		}
		const localColumns = mapFieldNamesToColumns({
			modelName: model.name,
			fieldNames: parsedRelation.fields,
			mapping,
			sourceId,
			diagnostics,
			span: relationAttribute.relation.span,
			contextLabel: `Relation field "${model.name}.${relationAttribute.field.name}"`
		});
		if (!localColumns) continue;
		const referencedColumns = mapFieldNamesToColumns({
			modelName: targetMapping.model.name,
			fieldNames: parsedRelation.references,
			mapping: targetMapping,
			sourceId,
			diagnostics,
			span: relationAttribute.relation.span,
			contextLabel: `Relation field "${model.name}.${relationAttribute.field.name}"`
		});
		if (!referencedColumns) continue;
		if (localColumns.length !== referencedColumns.length) {
			diagnostics.push({
				code: "PSL_INVALID_RELATION_ATTRIBUTE",
				message: `Relation field "${model.name}.${relationAttribute.field.name}" must provide the same number of fields and references`,
				sourceId,
				span: relationAttribute.relation.span
			});
			continue;
		}
		const onDelete = parsedRelation.onDelete ? normalizeReferentialAction({
			modelName: model.name,
			fieldName: relationAttribute.field.name,
			actionName: "onDelete",
			actionToken: parsedRelation.onDelete,
			sourceId,
			span: relationAttribute.field.span,
			diagnostics
		}) : void 0;
		const onUpdate = parsedRelation.onUpdate ? normalizeReferentialAction({
			modelName: model.name,
			fieldName: relationAttribute.field.name,
			actionName: "onUpdate",
			actionToken: parsedRelation.onUpdate,
			sourceId,
			span: relationAttribute.field.span,
			diagnostics
		}) : void 0;
		foreignKeyNodes.push({
			columns: localColumns,
			references: {
				model: targetMapping.model.name,
				table: targetMapping.tableName,
				columns: referencedColumns
			},
			...ifDefined("name", parsedRelation.constraintName),
			...ifDefined("onDelete", onDelete),
			...ifDefined("onUpdate", onUpdate)
		});
		resultFkRelationMetadata.push({
			declaringModelName: model.name,
			declaringFieldName: relationAttribute.field.name,
			declaringTableName: tableName,
			targetModelName: targetMapping.model.name,
			targetTableName: targetMapping.tableName,
			...ifDefined("relationName", parsedRelation.relationName),
			localColumns,
			referencedColumns
		});
	}
	return {
		modelNode: {
			modelName: model.name,
			tableName,
			fields: resolvedFields.map((resolvedField) => ({
				fieldName: resolvedField.field.name,
				columnName: resolvedField.columnName,
				descriptor: resolvedField.descriptor,
				nullable: resolvedField.field.optional,
				...ifDefined("default", resolvedField.defaultValue),
				...ifDefined("executionDefault", resolvedField.executionDefault)
			})),
			...primaryKeyColumns.length > 0 ? { id: {
				columns: primaryKeyColumns,
				...ifDefined("name", primaryKeyName)
			} } : {},
			...uniqueConstraints.length > 0 ? { uniques: uniqueConstraints } : {},
			...indexNodes.length > 0 ? { indexes: indexNodes } : {},
			...foreignKeyNodes.length > 0 ? { foreignKeys: foreignKeyNodes } : {}
		},
		fkRelationMetadata: resultFkRelationMetadata,
		backrelationCandidates: resultBackrelationCandidates,
		resolvedFields
	};
}
function buildValueObjects(input) {
	const { compositeTypes, enumTypeDescriptors, namedTypeDescriptors, scalarTypeDescriptors, composedExtensions, familyId, targetId, authoringContributions, diagnostics, sourceId } = input;
	const valueObjects = {};
	const compositeTypeNames = new Set(compositeTypes.map((ct) => ct.name));
	for (const compositeType of compositeTypes) {
		const fields = {};
		for (const field of compositeType.fields) {
			if (compositeTypeNames.has(field.typeName)) {
				const result = {
					type: {
						kind: "valueObject",
						name: field.typeName
					},
					nullable: field.optional
				};
				fields[field.name] = field.list ? {
					...result,
					many: true
				} : result;
				continue;
			}
			const resolved = resolveFieldTypeDescriptor({
				field,
				enumTypeDescriptors,
				namedTypeDescriptors,
				scalarTypeDescriptors,
				authoringContributions,
				composedExtensions,
				familyId,
				targetId,
				diagnostics,
				sourceId,
				entityLabel: `Field "${compositeType.name}.${field.name}"`
			});
			if (!resolved.ok) {
				if (!resolved.alreadyReported) diagnostics.push({
					code: "PSL_UNSUPPORTED_FIELD_TYPE",
					message: `Field "${compositeType.name}.${field.name}" type "${field.typeName}" is not supported`,
					sourceId,
					span: field.span
				});
				continue;
			}
			const scalarField = {
				nullable: field.optional,
				type: {
					kind: "scalar",
					codecId: resolved.descriptor.codecId
				}
			};
			fields[field.name] = field.list ? {
				...scalarField,
				many: true
			} : scalarField;
		}
		valueObjects[compositeType.name] = { fields };
	}
	return valueObjects;
}
function patchModelDomainFields(models, modelResolvedFields) {
	let patched = models;
	for (const [modelName, resolvedFields] of modelResolvedFields) {
		const model = patched[modelName];
		if (!model) continue;
		let needsPatch = false;
		const patchedFields = { ...model.fields };
		for (const rf of resolvedFields) if (rf.valueObjectTypeName) {
			needsPatch = true;
			patchedFields[rf.field.name] = {
				nullable: rf.field.optional,
				type: {
					kind: "valueObject",
					name: rf.valueObjectTypeName
				},
				...rf.many ? { many: true } : {}
			};
		} else if (rf.many && rf.scalarCodecId) {
			needsPatch = true;
			patchedFields[rf.field.name] = {
				nullable: rf.field.optional,
				type: {
					kind: "scalar",
					codecId: rf.scalarCodecId
				},
				many: true
			};
		}
		if (needsPatch) patched = {
			...patched,
			[modelName]: {
				...model,
				fields: patchedFields
			}
		};
	}
	return patched;
}
function collectPolymorphismDeclarations(models, sourceId, diagnostics) {
	const discriminatorDeclarations = /* @__PURE__ */ new Map();
	const baseDeclarations = /* @__PURE__ */ new Map();
	for (const model of models) for (const attr of model.attributes) {
		if (attr.name === "discriminator") {
			const fieldName = getPositionalArgument(attr);
			if (!fieldName) {
				diagnostics.push({
					code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
					message: `Model "${model.name}" @@discriminator requires a field name argument`,
					sourceId,
					span: attr.span
				});
				continue;
			}
			const discField = model.fields.find((f) => f.name === fieldName);
			if (discField && discField.typeName !== "String") {
				diagnostics.push({
					code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
					message: `Discriminator field "${fieldName}" on model "${model.name}" must be of type String, but is "${discField.typeName}"`,
					sourceId,
					span: attr.span
				});
				continue;
			}
			discriminatorDeclarations.set(model.name, {
				fieldName,
				span: attr.span
			});
		}
		if (attr.name === "base") {
			const baseName = getPositionalArgument(attr, 0);
			const rawValue = getPositionalArgument(attr, 1);
			if (!baseName || !rawValue) {
				diagnostics.push({
					code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
					message: `Model "${model.name}" @@base requires two arguments: base model name and discriminator value`,
					sourceId,
					span: attr.span
				});
				continue;
			}
			const value = parseQuotedStringLiteral(rawValue);
			if (value === void 0) {
				diagnostics.push({
					code: "PSL_INVALID_ATTRIBUTE_ARGUMENT",
					message: `Model "${model.name}" @@base discriminator value must be a quoted string literal`,
					sourceId,
					span: attr.span
				});
				continue;
			}
			baseDeclarations.set(model.name, {
				baseName,
				value,
				span: attr.span
			});
		}
	}
	return {
		discriminatorDeclarations,
		baseDeclarations
	};
}
function resolvePolymorphism(models, discriminatorDeclarations, baseDeclarations, modelNames, modelMappings, sourceId, diagnostics) {
	let patched = models;
	for (const [modelName, decl] of discriminatorDeclarations) {
		if (baseDeclarations.has(modelName)) {
			diagnostics.push({
				code: "PSL_DISCRIMINATOR_AND_BASE",
				message: `Model "${modelName}" cannot have both @@discriminator and @@base`,
				sourceId,
				span: decl.span
			});
			continue;
		}
		const model = patched[modelName];
		if (!model) continue;
		if (!Object.hasOwn(model.fields, decl.fieldName)) {
			diagnostics.push({
				code: "PSL_DISCRIMINATOR_FIELD_NOT_FOUND",
				message: `Discriminator field "${decl.fieldName}" is not a field on model "${modelName}"`,
				sourceId,
				span: decl.span
			});
			continue;
		}
		const variants = {};
		const seenValues = /* @__PURE__ */ new Map();
		for (const [variantName, baseDecl] of baseDeclarations) {
			if (baseDecl.baseName !== modelName) continue;
			const existingVariant = seenValues.get(baseDecl.value);
			if (existingVariant) {
				diagnostics.push({
					code: "PSL_DUPLICATE_DISCRIMINATOR_VALUE",
					message: `Discriminator value "${baseDecl.value}" is used by both "${existingVariant}" and "${variantName}" on base model "${modelName}"`,
					sourceId,
					span: baseDecl.span
				});
				continue;
			}
			seenValues.set(baseDecl.value, variantName);
			variants[variantName] = { value: baseDecl.value };
		}
		if (Object.keys(variants).length === 0) {
			diagnostics.push({
				code: "PSL_ORPHANED_DISCRIMINATOR",
				message: `Model "${modelName}" has @@discriminator but no variant models declare @@base(${modelName}, ...)`,
				sourceId,
				span: decl.span
			});
			continue;
		}
		patched = {
			...patched,
			[modelName]: {
				...model,
				discriminator: { field: decl.fieldName },
				variants
			}
		};
	}
	for (const [variantName, baseDecl] of baseDeclarations) {
		if (!modelNames.has(baseDecl.baseName)) {
			diagnostics.push({
				code: "PSL_BASE_TARGET_NOT_FOUND",
				message: `Model "${variantName}" @@base references non-existent model "${baseDecl.baseName}"`,
				sourceId,
				span: baseDecl.span
			});
			continue;
		}
		if (!discriminatorDeclarations.has(baseDecl.baseName)) {
			diagnostics.push({
				code: "PSL_ORPHANED_BASE",
				message: `Model "${variantName}" declares @@base(${baseDecl.baseName}, ...) but "${baseDecl.baseName}" has no @@discriminator`,
				sourceId,
				span: baseDecl.span
			});
			continue;
		}
		if (discriminatorDeclarations.has(variantName)) continue;
		const variantModel = patched[variantName];
		if (!variantModel) continue;
		const baseMapping = modelMappings.get(baseDecl.baseName);
		const variantMapping = modelMappings.get(variantName);
		const resolvedTable = variantMapping?.model.attributes.some((attr) => attr.name === "map") ?? false ? variantMapping?.tableName : baseMapping?.tableName;
		patched = {
			...patched,
			[variantName]: {
				...variantModel,
				base: baseDecl.baseName,
				...resolvedTable ? { storage: {
					...variantModel.storage,
					table: resolvedTable
				} } : {}
			}
		};
	}
	return patched;
}
function interpretPslDocumentToSqlContract(input) {
	const sourceId = input.document.ast.sourceId;
	if (!input.target) return notOk({
		summary: "PSL to SQL contract interpretation failed",
		diagnostics: [{
			code: "PSL_TARGET_CONTEXT_REQUIRED",
			message: "PSL interpretation requires an explicit target context from composition.",
			sourceId
		}]
	});
	if (!input.scalarTypeDescriptors) return notOk({
		summary: "PSL to SQL contract interpretation failed",
		diagnostics: [{
			code: "PSL_SCALAR_TYPE_CONTEXT_REQUIRED",
			message: "PSL interpretation requires composed scalar type descriptors.",
			sourceId
		}]
	});
	const diagnostics = mapParserDiagnostics(input.document);
	const models = input.document.ast.models ?? [];
	const enums = input.document.ast.enums ?? [];
	const compositeTypes = input.document.ast.compositeTypes ?? [];
	const modelNames = new Set(models.map((model) => model.name));
	const compositeTypeNames = new Set(compositeTypes.map((ct) => ct.name));
	const composedExtensions = new Set(input.composedExtensionPacks ?? []);
	const defaultFunctionRegistry = input.controlMutationDefaults?.defaultFunctionRegistry ?? /* @__PURE__ */ new Map();
	const generatorDescriptors = input.controlMutationDefaults?.generatorDescriptors ?? [];
	const generatorDescriptorById = /* @__PURE__ */ new Map();
	for (const descriptor of generatorDescriptors) generatorDescriptorById.set(descriptor.id, descriptor);
	const enumResult = processEnumDeclarations({
		enums,
		sourceId,
		enumTypeConstructor: getAuthoringTypeConstructor(input.authoringContributions, ["enum"]),
		diagnostics
	});
	const namedTypeResult = resolveNamedTypeDeclarations({
		declarations: input.document.ast.types?.declarations ?? [],
		sourceId,
		enumTypeDescriptors: enumResult.enumTypeDescriptors,
		scalarTypeDescriptors: input.scalarTypeDescriptors,
		composedExtensions,
		familyId: input.target.familyId,
		targetId: input.target.targetId,
		authoringContributions: input.authoringContributions,
		diagnostics
	});
	const storageTypes = {
		...enumResult.storageTypes,
		...namedTypeResult.storageTypes
	};
	const modelMappings = buildModelMappings(models, diagnostics, sourceId);
	const modelNodes = [];
	const fkRelationMetadata = [];
	const backrelationCandidates = [];
	const modelResolvedFields = /* @__PURE__ */ new Map();
	for (const model of models) {
		const mapping = modelMappings.get(model.name);
		if (!mapping) continue;
		const result = buildModelNodeFromPsl({
			model,
			mapping,
			modelMappings,
			modelNames,
			compositeTypeNames,
			enumTypeDescriptors: enumResult.enumTypeDescriptors,
			namedTypeDescriptors: namedTypeResult.namedTypeDescriptors,
			composedExtensions,
			familyId: input.target.familyId,
			targetId: input.target.targetId,
			authoringContributions: input.authoringContributions,
			defaultFunctionRegistry,
			generatorDescriptorById,
			scalarTypeDescriptors: input.scalarTypeDescriptors,
			sourceId,
			diagnostics
		});
		modelNodes.push(result.modelNode);
		fkRelationMetadata.push(...result.fkRelationMetadata);
		backrelationCandidates.push(...result.backrelationCandidates);
		modelResolvedFields.set(model.name, result.resolvedFields);
	}
	const { modelRelations, fkRelationsByPair } = indexFkRelations({ fkRelationMetadata });
	applyBackrelationCandidates({
		backrelationCandidates,
		fkRelationsByPair,
		modelRelations,
		diagnostics,
		sourceId
	});
	const { discriminatorDeclarations, baseDeclarations } = collectPolymorphismDeclarations(models, sourceId, diagnostics);
	const valueObjects = buildValueObjects({
		compositeTypes,
		enumTypeDescriptors: enumResult.enumTypeDescriptors,
		namedTypeDescriptors: namedTypeResult.namedTypeDescriptors,
		scalarTypeDescriptors: input.scalarTypeDescriptors,
		composedExtensions,
		familyId: input.target.familyId,
		targetId: input.target.targetId,
		authoringContributions: input.authoringContributions,
		diagnostics,
		sourceId
	});
	if (diagnostics.length > 0) return notOk({
		summary: "PSL to SQL contract interpretation failed",
		diagnostics: dedupeDiagnostics(diagnostics)
	});
	const contract = buildSqlContractFromDefinition({
		target: input.target,
		...ifDefined("extensionPacks", buildComposedExtensionPackRefs(input.target, [...composedExtensions].sort(compareStrings), input.composedExtensionPackRefs)),
		...Object.keys(storageTypes).length > 0 ? { storageTypes } : {},
		models: modelNodes.map((model) => ({
			...model,
			...modelRelations.has(model.modelName) ? { relations: [...modelRelations.get(model.modelName) ?? []].sort((left, right) => compareStrings(left.fieldName, right.fieldName)) } : {}
		}))
	});
	let patchedModels = patchModelDomainFields(contract.models, modelResolvedFields);
	const polyDiagnostics = [];
	patchedModels = resolvePolymorphism(patchedModels, discriminatorDeclarations, baseDeclarations, modelNames, modelMappings, sourceId, polyDiagnostics);
	if (polyDiagnostics.length > 0) return notOk({
		summary: "PSL to SQL contract interpretation failed",
		diagnostics: polyDiagnostics
	});
	const variantModelNames = new Set(baseDeclarations.keys());
	const filteredRoots = Object.fromEntries(Object.entries(contract.roots).filter(([, modelName]) => !variantModelNames.has(modelName)));
	return ok({
		...contract,
		roots: filteredRoots,
		models: patchedModels,
		...Object.keys(valueObjects).length > 0 ? { valueObjects } : {}
	});
}

//#endregion
export { interpretPslDocumentToSqlContract as t };
//# sourceMappingURL=interpreter-iFCRN9nb.mjs.map