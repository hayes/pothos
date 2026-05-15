import { AsyncIterableResult, RuntimeCore, checkAborted, checkMiddlewareCompatibility, isRuntimeError, raceAgainstAbort, runWithMiddleware, runtimeError } from "@prisma-next/framework-components/runtime";
import { type } from "arktype";
import { collectOrderedParamRefs, createCodecRegistry, isQueryAst } from "@prisma-next/sql-relational-core/ast";
import { ifDefined } from "@prisma-next/utils/defined";
import { synthesizeNonParameterizedDescriptor } from "@prisma-next/framework-components/codec";
import { checkContractComponentRequirements } from "@prisma-next/framework-components/components";
import { createExecutionStack } from "@prisma-next/framework-components/execution";
import { createSqlOperationRegistry } from "@prisma-next/sql-operations";
import { createHash } from "node:crypto";

//#region src/codecs/validation.ts
function extractCodecIds(contract) {
	const codecIds = /* @__PURE__ */ new Set();
	for (const table of Object.values(contract.storage.tables)) for (const column of Object.values(table.columns)) {
		const codecId = column.codecId;
		codecIds.add(codecId);
	}
	return codecIds;
}
function extractCodecIdsFromColumns(contract) {
	const codecIds = /* @__PURE__ */ new Map();
	for (const [tableName, table] of Object.entries(contract.storage.tables)) for (const [columnName, column] of Object.entries(table.columns)) {
		const codecId = column.codecId;
		const key = `${tableName}.${columnName}`;
		codecIds.set(key, codecId);
	}
	return codecIds;
}
function adaptDescriptorRegistry(registry) {
	return { has: (id) => registry.descriptorFor(id) !== void 0 };
}
function isDescriptorRegistry(registry) {
	return "descriptorFor" in registry;
}
function validateContractCodecMappings(registry, contract) {
	const lookup = isDescriptorRegistry(registry) ? adaptDescriptorRegistry(registry) : registry;
	const codecIds = extractCodecIdsFromColumns(contract);
	const invalidCodecs = [];
	for (const [key, codecId] of codecIds.entries()) if (!lookup.has(codecId)) {
		const parts = key.split(".");
		const table = parts[0] ?? "";
		const column = parts[1] ?? "";
		invalidCodecs.push({
			table,
			column,
			codecId
		});
	}
	if (invalidCodecs.length > 0) {
		const details = {
			contractTarget: contract.target,
			invalidCodecs
		};
		throw runtimeError("RUNTIME.CODEC_MISSING", `Missing codec implementations for column codecIds: ${invalidCodecs.map((c) => `${c.table}.${c.column} (${c.codecId})`).join(", ")}`, details);
	}
}
function validateCodecRegistryCompleteness(registry, contract) {
	validateContractCodecMappings(registry, contract);
}

//#endregion
//#region src/lower-sql-plan.ts
/**
* Lowers a SQL query plan to an executable Plan by calling the adapter's lower method.
*
* @param adapter - Adapter to lower AST to SQL
* @param contract - Contract for lowering context
* @param queryPlan - SQL query plan from a lane (contains AST, params, meta, but no SQL)
* @returns Fully executable Plan with SQL string
*/
function lowerSqlPlan(adapter, contract, queryPlan) {
	const lowered = adapter.lower(queryPlan.ast, {
		contract,
		params: queryPlan.params
	});
	return Object.freeze({
		sql: lowered.sql,
		params: lowered.params ?? queryPlan.params,
		ast: queryPlan.ast,
		meta: queryPlan.meta
	});
}

//#endregion
//#region src/marker.ts
const MetaSchema = type({ "[string]": "unknown" });
function parseMeta(meta) {
	if (meta === null || meta === void 0) return {};
	let parsed;
	if (typeof meta === "string") try {
		parsed = JSON.parse(meta);
	} catch {
		return {};
	}
	else parsed = meta;
	const result = MetaSchema(parsed);
	if (result instanceof type.errors) return {};
	return result;
}
const ContractMarkerRowSchema = type({
	core_hash: "string",
	profile_hash: "string",
	"contract_json?": "unknown | null",
	"canonical_version?": "number | null",
	"updated_at?": "Date | string",
	"app_tag?": "string | null",
	"meta?": "unknown | null",
	invariants: type("string").array()
});
function parseContractMarkerRow(row) {
	const result = ContractMarkerRowSchema(row);
	if (result instanceof type.errors) {
		const messages = result.map((p) => p.message).join("; ");
		throw new Error(`Invalid contract marker row: ${messages}`);
	}
	const updatedAt = result.updated_at ? result.updated_at instanceof Date ? result.updated_at : new Date(result.updated_at) : /* @__PURE__ */ new Date();
	return {
		storageHash: result.core_hash,
		profileHash: result.profile_hash,
		contractJson: result.contract_json ?? null,
		canonicalVersion: result.canonical_version ?? null,
		updatedAt,
		appTag: result.app_tag ?? null,
		meta: parseMeta(result.meta),
		invariants: result.invariants
	};
}

//#endregion
//#region src/middleware/budgets.ts
function hasAggregateWithoutGroupBy(ast) {
	if (ast.groupBy !== void 0) return false;
	return ast.projection.some((item) => item.expr.kind === "aggregate");
}
function primaryTableFromAst(ast) {
	switch (ast.from.kind) {
		case "table-source": return ast.from.name;
		case "derived-table-source": return ast.from.alias;
		default: return;
	}
}
function estimateRowsFromAst(ast, tableRows, defaultTableRows, hasAggregateWithoutGroup) {
	if (hasAggregateWithoutGroup) return 1;
	const table = primaryTableFromAst(ast);
	if (!table) return null;
	const tableEstimate = tableRows[table] ?? defaultTableRows;
	if (ast.limit !== void 0) return Math.min(ast.limit, tableEstimate);
	return tableEstimate;
}
function emitBudgetViolation(error, shouldBlock, ctx) {
	if (shouldBlock) throw error;
	ctx.log.warn({
		code: error.code,
		message: error.message,
		details: error.details
	});
}
function budgets(options) {
	const maxRows = options?.maxRows ?? 1e4;
	const defaultTableRows = options?.defaultTableRows ?? 1e4;
	const tableRows = options?.tableRows ?? {};
	const maxLatencyMs = options?.maxLatencyMs ?? 1e3;
	const rowSeverity = options?.severities?.rowCount ?? "error";
	const observedRowsByPlan = /* @__PURE__ */ new WeakMap();
	return Object.freeze({
		name: "budgets",
		familyId: "sql",
		async beforeExecute(plan, ctx) {
			observedRowsByPlan.set(plan, { count: 0 });
			if (isQueryAst(plan.ast) && plan.ast.kind === "select") return evaluateSelectAst(plan.ast, ctx);
		},
		async onRow(_row, plan, _ctx) {
			const state = observedRowsByPlan.get(plan);
			if (!state) return;
			state.count += 1;
			if (state.count > maxRows) throw runtimeError("BUDGET.ROWS_EXCEEDED", "Observed row count exceeds budget", {
				source: "observed",
				observedRows: state.count,
				maxRows
			});
		},
		async afterExecute(_plan, result, ctx) {
			const latencyMs = result.latencyMs;
			if (latencyMs > maxLatencyMs) {
				const shouldBlock = ctx.mode === "strict";
				emitBudgetViolation(runtimeError("BUDGET.TIME_EXCEEDED", "Query latency exceeds budget", {
					latencyMs,
					maxLatencyMs
				}), shouldBlock, ctx);
			}
		}
	});
	function evaluateSelectAst(ast, ctx) {
		const hasAggNoGroup = hasAggregateWithoutGroupBy(ast);
		const estimated = estimateRowsFromAst(ast, tableRows, defaultTableRows, hasAggNoGroup);
		const isUnbounded = ast.limit === void 0 && !hasAggNoGroup;
		const shouldBlock = rowSeverity === "error" || ctx.mode === "strict";
		if (isUnbounded) {
			if (estimated !== null && estimated >= maxRows) {
				emitBudgetViolation(runtimeError("BUDGET.ROWS_EXCEEDED", "Unbounded SELECT query exceeds budget", {
					source: "ast",
					estimatedRows: estimated,
					maxRows
				}), shouldBlock, ctx);
				return;
			}
			emitBudgetViolation(runtimeError("BUDGET.ROWS_EXCEEDED", "Unbounded SELECT query exceeds budget", {
				source: "ast",
				maxRows
			}), shouldBlock, ctx);
			return;
		}
		if (estimated !== null && estimated > maxRows) emitBudgetViolation(runtimeError("BUDGET.ROWS_EXCEEDED", "Estimated row count exceeds budget", {
			source: "ast",
			estimatedRows: estimated,
			maxRows
		}), shouldBlock, ctx);
	}
}

//#endregion
//#region src/guardrails/raw.ts
const SELECT_STAR_REGEX = /select\s+\*/i;
const LIMIT_REGEX = /\blimit\b/i;
const MUTATION_PREFIX_REGEX = /^(insert|update|delete|create|alter|drop|truncate)\b/i;
const READ_ONLY_INTENTS = new Set([
	"read",
	"report",
	"readonly"
]);
function evaluateRawGuardrails(plan, config) {
	const lints$1 = [];
	const budgets$1 = [];
	const normalized = normalizeWhitespace(plan.sql);
	const statementType = classifyStatement(normalized);
	if (statementType === "select") {
		if (SELECT_STAR_REGEX.test(normalized)) lints$1.push(createLint("LINT.SELECT_STAR", "error", "Raw SQL plan selects all columns via *", { sql: snippet(plan.sql) }));
		if (!LIMIT_REGEX.test(normalized)) {
			const severity = config?.budgets?.unboundedSelectSeverity ?? "error";
			lints$1.push(createLint("LINT.NO_LIMIT", "warn", "Raw SQL plan omits LIMIT clause", { sql: snippet(plan.sql) }));
			budgets$1.push(createBudget("BUDGET.ROWS_EXCEEDED", severity, "Raw SQL plan is unbounded and may exceed row budget", {
				sql: snippet(plan.sql),
				...config?.budgets?.estimatedRows !== void 0 ? { estimatedRows: config.budgets.estimatedRows } : {}
			}));
		}
	}
	if (isMutationStatement(statementType) && isReadOnlyIntent(plan.meta)) lints$1.push(createLint("LINT.READ_ONLY_MUTATION", "error", "Raw SQL plan mutates data despite read-only intent", {
		sql: snippet(plan.sql),
		intent: plan.meta.annotations?.["intent"]
	}));
	return {
		lints: lints$1,
		budgets: budgets$1,
		statement: statementType
	};
}
function classifyStatement(sql) {
	const trimmed = sql.trim();
	const lower = trimmed.toLowerCase();
	if (lower.startsWith("with")) {
		if (lower.includes("select")) return "select";
	}
	if (lower.startsWith("select")) return "select";
	if (MUTATION_PREFIX_REGEX.test(trimmed)) return "mutation";
	return "other";
}
function isMutationStatement(statement) {
	return statement === "mutation";
}
function isReadOnlyIntent(meta) {
	const annotations = meta.annotations;
	const intent = typeof annotations?.intent === "string" ? annotations.intent.toLowerCase() : void 0;
	return intent !== void 0 && READ_ONLY_INTENTS.has(intent);
}
function normalizeWhitespace(value) {
	return value.replace(/\s+/g, " ").trim();
}
function snippet(sql) {
	return normalizeWhitespace(sql).slice(0, 200);
}
function createLint(code, severity, message, details) {
	return {
		code,
		severity,
		message,
		...details ? { details } : {}
	};
}
function createBudget(code, severity, message, details) {
	return {
		code,
		severity,
		message,
		...details ? { details } : {}
	};
}

//#endregion
//#region src/middleware/lints.ts
function getFromSourceTableDetail(source) {
	switch (source.kind) {
		case "table-source": return source.name;
		case "derived-table-source": return source.alias;
		default: throw new Error(`Unsupported source kind: ${source.kind}`);
	}
}
function evaluateAstLints(ast) {
	const findings = [];
	switch (ast.kind) {
		case "delete":
			if (ast.where === void 0) findings.push({
				code: "LINT.DELETE_WITHOUT_WHERE",
				severity: "error",
				message: "DELETE without WHERE clause blocks execution to prevent accidental full-table deletion",
				details: { table: ast.table.name }
			});
			break;
		case "update":
			if (ast.where === void 0) findings.push({
				code: "LINT.UPDATE_WITHOUT_WHERE",
				severity: "error",
				message: "UPDATE without WHERE clause blocks execution to prevent accidental full-table update",
				details: { table: ast.table.name }
			});
			break;
		case "select":
			if (ast.limit === void 0) {
				const table = getFromSourceTableDetail(ast.from);
				findings.push({
					code: "LINT.NO_LIMIT",
					severity: "warn",
					message: "Unbounded SELECT may return large result sets",
					...ifDefined("details", table !== void 0 ? { table } : void 0)
				});
			}
			if (ast.selectAllIntent !== void 0) {
				const table = ast.selectAllIntent.table;
				findings.push({
					code: "LINT.SELECT_STAR",
					severity: "warn",
					message: "Query selects all columns via selectAll intent",
					...ifDefined("details", table !== void 0 ? { table } : void 0)
				});
			}
			break;
		case "insert": break;
		default: throw new Error(`Unsupported AST kind: ${ast.kind}`);
	}
	return findings;
}
function getConfiguredSeverity(code, options) {
	const severities = options?.severities;
	if (!severities) return void 0;
	switch (code) {
		case "LINT.SELECT_STAR": return severities.selectStar;
		case "LINT.NO_LIMIT": return severities.noLimit;
		case "LINT.DELETE_WITHOUT_WHERE": return severities.deleteWithoutWhere;
		case "LINT.UPDATE_WITHOUT_WHERE": return severities.updateWithoutWhere;
		case "LINT.READ_ONLY_MUTATION": return severities.readOnlyMutation;
		case "LINT.UNINDEXED_PREDICATE": return severities.unindexedPredicate;
		default: return;
	}
}
/**
* AST-first lint middleware for SQL plans. When `plan.ast` is a SQL QueryAst, inspects
* the AST structurally. When `plan.ast` is missing, falls back to raw heuristic
* guardrails or skips linting depending on `fallbackWhenAstMissing`.
*
* Rules (AST-based):
* - DELETE without WHERE: blocks execution (configurable severity, default error)
* - UPDATE without WHERE: blocks execution (configurable severity, default error)
* - Unbounded SELECT: warn/error (severity from noLimit)
* - SELECT * intent: warn/error (severity from selectStar)
*
* Fallback: When ast is missing, `fallbackWhenAstMissing: 'raw'` uses heuristic
* SQL parsing; `'skip'` skips all lints. Default is `'raw'`.
*/
function lints(options) {
	const fallback = options?.fallbackWhenAstMissing ?? "raw";
	return Object.freeze({
		name: "lints",
		familyId: "sql",
		async beforeExecute(plan, ctx) {
			if (isQueryAst(plan.ast)) {
				const findings = evaluateAstLints(plan.ast);
				for (const lint of findings) {
					const effectiveSeverity = getConfiguredSeverity(lint.code, options) ?? lint.severity;
					if (effectiveSeverity === "error") throw runtimeError(lint.code, lint.message, lint.details);
					if (effectiveSeverity === "warn") ctx.log.warn({
						code: lint.code,
						message: lint.message,
						details: lint.details
					});
				}
				return;
			}
			if (fallback === "skip") return;
			const evaluation = evaluateRawGuardrails(plan);
			for (const lint of evaluation.lints) {
				const effectiveSeverity = getConfiguredSeverity(lint.code, options) ?? lint.severity;
				if (effectiveSeverity === "error") throw runtimeError(lint.code, lint.message, lint.details);
				if (effectiveSeverity === "warn") ctx.log.warn({
					code: lint.code,
					message: lint.message,
					details: lint.details
				});
			}
		}
	});
}

//#endregion
//#region src/sql-context.ts
function createSqlExecutionStack(options) {
	return createExecutionStack({
		target: options.target,
		adapter: options.adapter,
		driver: options.driver,
		extensionPacks: options.extensionPacks
	});
}
function assertExecutionStackContractRequirements(contract, stack) {
	const providedComponentIds = new Set([
		stack.target.id,
		stack.adapter.id,
		...stack.extensionPacks.map((pack) => pack.id)
	]);
	const result = checkContractComponentRequirements({
		contract,
		expectedTargetFamily: "sql",
		expectedTargetId: stack.target.targetId,
		providedComponentIds
	});
	if (result.familyMismatch) throw runtimeError("RUNTIME.CONTRACT_FAMILY_MISMATCH", `Contract target family '${result.familyMismatch.actual}' does not match runtime family '${result.familyMismatch.expected}'.`, {
		actual: result.familyMismatch.actual,
		expected: result.familyMismatch.expected
	});
	if (result.targetMismatch) throw runtimeError("RUNTIME.CONTRACT_TARGET_MISMATCH", `Contract target '${result.targetMismatch.actual}' does not match runtime target descriptor '${result.targetMismatch.expected}'.`, {
		actual: result.targetMismatch.actual,
		expected: result.targetMismatch.expected
	});
	if (result.missingExtensionPackIds.length > 0) {
		const packIds = result.missingExtensionPackIds;
		throw runtimeError("RUNTIME.MISSING_EXTENSION_PACK", `Contract requires extension pack(s) ${packIds.map((id) => `'${id}'`).join(", ")}, but runtime descriptors do not provide matching component(s).`, { packIds });
	}
}
function validateTypeParams(typeParams, codecDescriptor, context) {
	const result = codecDescriptor.paramsSchema["~standard"].validate(typeParams);
	if (result instanceof Promise) throw runtimeError("RUNTIME.TYPE_PARAMS_INVALID", `paramsSchema for codec '${codecDescriptor.codecId}' returned a Promise; runtime validation requires a synchronous Standard Schema validator.`, {
		...context,
		codecId: codecDescriptor.codecId,
		typeParams
	});
	if (result.issues) {
		const messages = result.issues.map((issue) => issue.message).join("; ");
		throw runtimeError("RUNTIME.TYPE_PARAMS_INVALID", `Invalid typeParams for ${context.typeName ? `type '${context.typeName}'` : `column '${context.tableName}.${context.columnName}'`} (codecId: ${codecDescriptor.codecId}): ${messages}`, {
			...context,
			codecId: codecDescriptor.codecId,
			typeParams
		});
	}
	return result.value;
}
function collectParameterizedCodecDescriptors(contributors) {
	const descriptors = /* @__PURE__ */ new Map();
	for (const contributor of contributors) for (const descriptor of contributor.parameterizedCodecs()) {
		if (descriptors.has(descriptor.codecId)) throw runtimeError("RUNTIME.DUPLICATE_PARAMETERIZED_CODEC", `Duplicate parameterized codec descriptor for codecId '${descriptor.codecId}'.`, { codecId: descriptor.codecId });
		descriptors.set(descriptor.codecId, descriptor);
	}
	return descriptors;
}
/**
* Build the unified descriptor map. Combines parameterized descriptors
* (which already ship as `CodecDescriptor`s) with synthesized descriptors
* for non-parameterized codecs registered through the legacy `codecs:`
* slot. Codec ids that ship a parameterized descriptor take precedence —
* even when the legacy registry registers a representative codec under
* the same id, the parameterized descriptor is the authoritative source.
*
* Codec-registry-unification spec § Decision: every codec resolves
* through one descriptor map; reads are non-branching.
*/
function buildCodecDescriptorRegistry(codecRegistry, parameterizedDescriptors) {
	const byId = /* @__PURE__ */ new Map();
	const byTargetType = /* @__PURE__ */ new Map();
	function registerInIndices(descriptor) {
		byId.set(descriptor.codecId, descriptor);
		for (const targetType of descriptor.targetTypes) {
			const list = byTargetType.get(targetType);
			if (list) list.push(descriptor);
			else byTargetType.set(targetType, [descriptor]);
		}
	}
	for (const descriptor of parameterizedDescriptors.values()) registerInIndices(descriptor);
	for (const codec$1 of codecRegistry.values()) {
		if (byId.has(codec$1.id)) continue;
		registerInIndices(synthesizeNonParameterizedDescriptor(codec$1));
	}
	return {
		descriptorFor(codecId) {
			return byId.get(codecId);
		},
		*values() {
			yield* byId.values();
		},
		byTargetType(targetType) {
			return byTargetType.get(targetType) ?? Object.freeze([]);
		}
	};
}
function collectTypeRefSites(storage) {
	const sites = /* @__PURE__ */ new Map();
	for (const [tableName, table] of Object.entries(storage.tables)) for (const [columnName, column] of Object.entries(table.columns)) {
		if (typeof column.typeRef !== "string") continue;
		const list = sites.get(column.typeRef);
		const entry = {
			table: tableName,
			column: columnName
		};
		if (list) list.push(entry);
		else sites.set(column.typeRef, [entry]);
	}
	return sites;
}
function initializeTypeHelpers(storage, codecDescriptors) {
	const helpers = {};
	const storageTypes = storage.types;
	if (!storageTypes) return helpers;
	const typeRefSites = collectTypeRefSites(storage);
	for (const [typeName, typeInstance] of Object.entries(storageTypes)) {
		const descriptor = codecDescriptors.get(typeInstance.codecId);
		if (!descriptor) {
			helpers[typeName] = typeInstance;
			continue;
		}
		const validatedParams = validateTypeParams(typeInstance.typeParams, descriptor, { typeName });
		const ctx = {
			name: typeName,
			usedAt: typeRefSites.get(typeName) ?? []
		};
		helpers[typeName] = descriptor.factory(validatedParams)(ctx);
	}
	return helpers;
}
function validateColumnTypeParams(storage, codecDescriptors) {
	for (const [tableName, table] of Object.entries(storage.tables)) for (const [columnName, column] of Object.entries(table.columns)) if (column.typeParams) {
		const descriptor = codecDescriptors.get(column.codecId);
		if (descriptor) validateTypeParams(column.typeParams, descriptor, {
			tableName,
			columnName
		});
	}
}
function hasJsonValidatorTrait(candidate) {
	if (candidate === null || typeof candidate !== "object") return false;
	const traits = candidate.traits;
	if (!Array.isArray(traits)) return false;
	if (!traits.includes("json-validator")) return false;
	return typeof candidate.validate === "function";
}
function extractValidator(candidate) {
	return hasJsonValidatorTrait(candidate) ? candidate.validate : void 0;
}
function isResolvedCodec(candidate) {
	return candidate !== null && typeof candidate === "object" && "id" in candidate && "decode" in candidate;
}
/**
* Walk the contract's `storage.tables[].columns[]` and resolve each
* column to a `Codec` through the unified descriptor map. Per-instance
* behavior:
*
* - **typeRef columns**: reuse the resolved codec materialized once by
*   `initializeTypeHelpers` for the `storage.types` entry. Multiple
*   columns sharing one typeRef share one codec instance.
* - **inline-typeParams columns**: call `descriptor.factory(typeParams)
*   (ctx)` once per column (per-column anonymous instance).
* - **non-parameterized columns**: call `descriptor.factory()(ctx)`
*   once. The synthesized descriptor's factory is constant — every call
*   returns the same shared codec instance — so columns sharing a non-
*   parameterized codec id share one resolved codec without explicit
*   caching.
*
* Combines what `initializeTypeHelpers` (named-instance walk) and the
* old `buildJsonSchemaValidatorRegistry` (per-column walk) used to do
* separately: one walk over all columns, one resolved codec per column,
* one trait-gated validator extraction per column. The result drives
* both the dispatch registry (`ContractCodecRegistry.forColumn`) and the
* validator registry.
*
* Codec-registry-unification spec § AC-4: every column resolves through
* one descriptor map without branching on parameterization.
*/
function buildContractCodecRegistry(contract, codecDescriptors, legacyCodecRegistry, types, parameterizedDescriptors) {
	const byColumn = /* @__PURE__ */ new Map();
	const byCodecId = /* @__PURE__ */ new Map();
	const ambiguousCodecIds = /* @__PURE__ */ new Set();
	const validators = /* @__PURE__ */ new Map();
	for (const [tableName, table] of Object.entries(contract.storage.tables)) for (const [columnName, column] of Object.entries(table.columns)) {
		const columnKey = `${tableName}.${columnName}`;
		const descriptor = codecDescriptors.descriptorFor(column.codecId);
		let resolvedCodec;
		if (descriptor) {
			const isParameterized = parameterizedDescriptors.has(column.codecId);
			if (column.typeRef) {
				const helper = types[column.typeRef];
				if (isResolvedCodec(helper)) resolvedCodec = helper;
			} else if (column.typeParams && isParameterized) {
				const parameterizedDescriptor = parameterizedDescriptors.get(column.codecId);
				if (parameterizedDescriptor) {
					const validatedParams = validateTypeParams(column.typeParams, parameterizedDescriptor, {
						tableName,
						columnName
					});
					const ctx = {
						name: `<anon:${tableName}.${columnName}>`,
						usedAt: [{
							table: tableName,
							column: columnName
						}]
					};
					resolvedCodec = parameterizedDescriptor.factory(validatedParams)(ctx);
				}
			} else if (!isParameterized) {
				let cached = byCodecId.get(column.codecId);
				if (!cached) {
					const ctx = {
						name: `<shared:${column.codecId}>`,
						usedAt: [{
							table: tableName,
							column: columnName
						}]
					};
					const voidFactory = descriptor.factory;
					cached = voidFactory(void 0)(ctx);
					byCodecId.set(column.codecId, cached);
				}
				resolvedCodec = cached;
			}
		}
		if (resolvedCodec) {
			byColumn.set(columnKey, resolvedCodec);
			const validate = extractValidator(resolvedCodec);
			if (validate) validators.set(columnKey, validate);
			const existing = byCodecId.get(column.codecId);
			if (existing === void 0) byCodecId.set(column.codecId, resolvedCodec);
			else if (existing !== resolvedCodec && parameterizedDescriptors.has(column.codecId)) ambiguousCodecIds.add(column.codecId);
		}
	}
	return {
		registry: {
			forColumn(table, column) {
				return byColumn.get(`${table}.${column}`);
			},
			forCodecId(codecId) {
				if (ambiguousCodecIds.has(codecId)) throw runtimeError("RUNTIME.TYPE_PARAMS_INVALID", `Codec '${codecId}' resolves to multiple parameterized instances; column-aware dispatch is required.`, { codecId });
				return byCodecId.get(codecId) ?? legacyCodecRegistry.get(codecId);
			}
		},
		jsonValidators: validators.size > 0 ? {
			get: (key) => validators.get(key),
			size: validators.size
		} : void 0
	};
}
function collectMutationDefaultGenerators(contributors) {
	const generators = /* @__PURE__ */ new Map();
	const owners = /* @__PURE__ */ new Map();
	for (const contributor of contributors) {
		const nextGenerators = contributor.mutationDefaultGenerators?.() ?? [];
		for (const generator of nextGenerators) {
			const existingOwner = owners.get(generator.id);
			if (existingOwner !== void 0) throw runtimeError("RUNTIME.DUPLICATE_MUTATION_DEFAULT_GENERATOR", `Duplicate mutation default generator '${generator.id}'.`, {
				id: generator.id,
				existingOwner,
				incomingOwner: contributor.id
			});
			generators.set(generator.id, generator);
			owners.set(generator.id, contributor.id);
		}
	}
	return generators;
}
function computeExecutionDefaultValue(spec, generatorRegistry) {
	switch (spec.kind) {
		case "generator": {
			const generator = generatorRegistry.get(spec.id);
			if (!generator) throw runtimeError("RUNTIME.MUTATION_DEFAULT_GENERATOR_MISSING", `Contract references mutation default generator '${spec.id}' but no runtime component provides it.`, { id: spec.id });
			return generator.generate(spec.params);
		}
	}
}
function applyMutationDefaults(contract, generatorRegistry, options) {
	const defaults = contract.execution?.mutations.defaults ?? [];
	if (defaults.length === 0) return [];
	const applied = [];
	const appliedColumns = /* @__PURE__ */ new Set();
	for (const mutationDefault of defaults) {
		if (mutationDefault.ref.table !== options.table) continue;
		const defaultSpec = options.op === "create" ? mutationDefault.onCreate : mutationDefault.onUpdate;
		if (!defaultSpec) continue;
		const columnName = mutationDefault.ref.column;
		if (Object.hasOwn(options.values, columnName) || appliedColumns.has(columnName)) continue;
		applied.push({
			column: columnName,
			value: computeExecutionDefaultValue(defaultSpec, generatorRegistry)
		});
		appliedColumns.add(columnName);
	}
	return applied;
}
function createExecutionContext(options) {
	const { contract, stack } = options;
	assertExecutionStackContractRequirements(contract, stack);
	const codecRegistry = createCodecRegistry();
	const contributors = [
		stack.target,
		stack.adapter,
		...stack.extensionPacks
	];
	for (const contributor of contributors) for (const c of contributor.codecs().values()) codecRegistry.register(c);
	const queryOperationRegistry = createSqlOperationRegistry();
	for (const contributor of contributors) for (const op of contributor.queryOperations?.() ?? []) queryOperationRegistry.register(op);
	const parameterizedCodecDescriptors = collectParameterizedCodecDescriptors(contributors);
	const codecDescriptors = buildCodecDescriptorRegistry(codecRegistry, parameterizedCodecDescriptors);
	const mutationDefaultGeneratorRegistry = collectMutationDefaultGenerators(contributors);
	if (parameterizedCodecDescriptors.size > 0) validateColumnTypeParams(contract.storage, parameterizedCodecDescriptors);
	const types = initializeTypeHelpers(contract.storage, parameterizedCodecDescriptors);
	const { registry: contractCodecs, jsonValidators: jsonSchemaValidators } = buildContractCodecRegistry(contract, codecDescriptors, codecRegistry, types, parameterizedCodecDescriptors);
	return {
		contract,
		codecs: codecRegistry,
		contractCodecs,
		codecDescriptors,
		queryOperations: queryOperationRegistry,
		types,
		...jsonSchemaValidators ? { jsonSchemaValidators } : {},
		applyMutationDefaults: (options$1) => applyMutationDefaults(contract, mutationDefaultGeneratorRegistry, options$1)
	};
}

//#endregion
//#region src/sql-marker.ts
const ensureSchemaStatement = {
	sql: "create schema if not exists prisma_contract",
	params: []
};
const ensureTableStatement = {
	sql: `create table if not exists prisma_contract.marker (
    id smallint primary key default 1,
    core_hash text not null,
    profile_hash text not null,
    contract_json jsonb,
    canonical_version int,
    updated_at timestamptz not null default now(),
    app_tag text,
    meta jsonb not null default '{}',
    invariants text[] not null default '{}'
  )`,
	params: []
};
function readContractMarker() {
	return {
		sql: `select
      core_hash,
      profile_hash,
      contract_json,
      canonical_version,
      updated_at,
      app_tag,
      meta,
      invariants
    from prisma_contract.marker
    where id = $1`,
		params: [1]
	};
}
/**
* Variable columns that participate in INSERT/UPDATE alongside the
* always-on `id = $1` and `updated_at = now()`. Each column declares
* its name, optional cast type, and parameter value; the placeholder
* (`$N`) is computed positionally below — adding or reordering a
* column doesn't desync indices. `invariants` only appears when the
* caller supplies it — see `WriteMarkerInput.invariants`.
*/
function markerColumns(input) {
	return [
		{
			name: "core_hash",
			param: input.storageHash
		},
		{
			name: "profile_hash",
			param: input.profileHash
		},
		{
			name: "contract_json",
			type: "jsonb",
			param: input.contractJson ?? null
		},
		{
			name: "canonical_version",
			param: input.canonicalVersion ?? null
		},
		{
			name: "app_tag",
			param: input.appTag ?? null
		},
		{
			name: "meta",
			type: "jsonb",
			param: JSON.stringify(input.meta ?? {})
		},
		...input.invariants !== void 0 ? [{
			name: "invariants",
			type: "text[]",
			param: input.invariants
		}] : []
	];
}
function writeContractMarker(input) {
	const placed = markerColumns(input).map((c, i) => ({
		name: c.name,
		expr: c.type ? `$${i + 2}::${c.type}` : `$${i + 2}`,
		param: c.param
	}));
	const params = [1, ...placed.map((c) => c.param)];
	const insertColumns = [
		"id",
		...placed.map((c) => c.name),
		"updated_at"
	].join(", ");
	const insertValues = [
		"$1",
		...placed.map((c) => c.expr),
		"now()"
	].join(", ");
	const setClauses = [...placed.map((c) => `${c.name} = ${c.expr}`), "updated_at = now()"].join(", ");
	return {
		insert: {
			sql: `insert into prisma_contract.marker (${insertColumns}) values (${insertValues})`,
			params
		},
		update: {
			sql: `update prisma_contract.marker set ${setClauses} where id = $1`,
			params
		}
	};
}

//#endregion
//#region src/codecs/json-schema-validation.ts
/**
* Validates a JSON value against its column's JSON Schema, if a validator exists.
*
* Throws `RUNTIME.JSON_SCHEMA_VALIDATION_FAILED` on validation failure.
* No-ops if no validator is registered for the column.
*/
function validateJsonValue(registry, table, column, value, direction, codecId) {
	const key = `${table}.${column}`;
	const validate = registry.get(key);
	if (!validate) return;
	const result = validate(value);
	if (result.valid) return;
	throw createJsonSchemaValidationError(table, column, direction, result.errors, codecId);
}
function createJsonSchemaValidationError(table, column, direction, errors, codecId) {
	return runtimeError("RUNTIME.JSON_SCHEMA_VALIDATION_FAILED", `JSON schema validation failed for column '${table}.${column}' (${direction}): ${formatErrorSummary(errors)}`, {
		table,
		column,
		codecId,
		direction,
		errors: [...errors]
	});
}
function formatErrorSummary(errors) {
	if (errors.length === 0) return "unknown validation error";
	if (errors.length === 1) {
		const err = errors[0];
		return err.path === "/" ? err.message : `${err.path}: ${err.message}`;
	}
	return errors.map((err) => err.path === "/" ? err.message : `${err.path}: ${err.message}`).join("; ");
}

//#endregion
//#region src/codecs/decoding.ts
const WIRE_PREVIEW_LIMIT = 100;
const EMPTY_INCLUDE_ALIASES = /* @__PURE__ */ new Set();
function isAstBackedPlan(plan) {
	return plan.ast !== void 0;
}
function projectionListFromAst(ast) {
	if (ast.kind === "select") return ast.projection;
	return ast.returning;
}
/**
* Resolve the per-cell codec for a projection item.
*
* Phase B: when a `(table, column)` ref is available for the projection,
* prefer `contractCodecs.forColumn(table, column)` — that's the per-
* instance resolved codec materialized from the codec descriptor's
* factory at context-construction time (carries any per-instance state
* such as the compiled JSON-Schema validator). When the projection
* resolves to a non-`column-ref` expression (computed projections, raw
* SQL aliases) but still carries a codec id (ADR 205 stamps every
* `ProjectionItem` with the producer's codec id), fall back to the
* codec-id-keyed `forCodecId(codecId)` lookup, which itself falls back
* to the legacy `CodecRegistry` for codec ids the contract walk
* couldn't resolve.
*
* Codec-registry-unification spec § AC-4.
*/
function resolveProjectionCodec(item, registry, contractCodecs) {
	if (item.expr.kind === "column-ref" && contractCodecs) {
		const byColumn = contractCodecs.forColumn(item.expr.table, item.expr.column);
		if (byColumn) return byColumn;
	}
	if (item.codecId) {
		const fromContract = contractCodecs?.forCodecId(item.codecId);
		if (fromContract) return fromContract;
		return registry.get(item.codecId);
	}
}
function buildDecodeContext(plan, registry, contractCodecs) {
	if (!isAstBackedPlan(plan)) return {
		aliases: void 0,
		codecs: /* @__PURE__ */ new Map(),
		columnRefs: /* @__PURE__ */ new Map(),
		includeAliases: EMPTY_INCLUDE_ALIASES
	};
	const projection = projectionListFromAst(plan.ast);
	if (!projection) return {
		aliases: void 0,
		codecs: /* @__PURE__ */ new Map(),
		columnRefs: /* @__PURE__ */ new Map(),
		includeAliases: EMPTY_INCLUDE_ALIASES
	};
	const aliases = [];
	const codecs = /* @__PURE__ */ new Map();
	const columnRefs = /* @__PURE__ */ new Map();
	const includeAliases = /* @__PURE__ */ new Set();
	for (const item of projection) {
		aliases.push(item.alias);
		const codec$1 = resolveProjectionCodec(item, registry, contractCodecs);
		if (codec$1) codecs.set(item.alias, codec$1);
		if (item.expr.kind === "column-ref") columnRefs.set(item.alias, {
			table: item.expr.table,
			column: item.expr.column
		});
		else if (item.expr.kind === "subquery" || item.expr.kind === "json-array-agg") includeAliases.add(item.alias);
	}
	return {
		aliases,
		codecs,
		columnRefs,
		includeAliases
	};
}
function previewWireValue(wireValue) {
	if (typeof wireValue === "string") return wireValue.length > WIRE_PREVIEW_LIMIT ? `${wireValue.substring(0, WIRE_PREVIEW_LIMIT)}...` : wireValue;
	return String(wireValue).substring(0, WIRE_PREVIEW_LIMIT);
}
function isJsonSchemaValidationError(error) {
	return isRuntimeError(error) && error.code === "RUNTIME.JSON_SCHEMA_VALIDATION_FAILED";
}
function wrapDecodeFailure(error, alias, ref, codec$1, wireValue) {
	const message = error instanceof Error ? error.message : String(error);
	const wrapped = runtimeError("RUNTIME.DECODE_FAILED", `Failed to decode column ${ref ? `${ref.table}.${ref.column}` : alias} with codec '${codec$1.id}': ${message}`, {
		...ref ? {
			table: ref.table,
			column: ref.column
		} : { alias },
		codec: codec$1.id,
		wirePreview: previewWireValue(wireValue)
	});
	wrapped.cause = error;
	throw wrapped;
}
function wrapIncludeAggregateFailure(error, alias, wireValue) {
	const wrapped = runtimeError("RUNTIME.DECODE_FAILED", `Failed to parse JSON array for include alias '${alias}': ${error instanceof Error ? error.message : String(error)}`, {
		alias,
		wirePreview: previewWireValue(wireValue)
	});
	wrapped.cause = error;
	throw wrapped;
}
function decodeIncludeAggregate(alias, wireValue) {
	if (wireValue === null || wireValue === void 0) return [];
	try {
		let parsed;
		if (typeof wireValue === "string") parsed = JSON.parse(wireValue);
		else if (Array.isArray(wireValue)) parsed = wireValue;
		else parsed = JSON.parse(String(wireValue));
		if (!Array.isArray(parsed)) throw new Error(`Expected array for include alias '${alias}', got ${typeof parsed}`);
		return parsed;
	} catch (error) {
		wrapIncludeAggregateFailure(error, alias, wireValue);
	}
}
/**
* Decodes a single field. Single-armed: every cell takes the same path —
* `codec.decode → await → JSON-Schema validate → return plain value` — so
* sync- and async-authored codecs are indistinguishable to callers.
*
* The row-level `rowCtx` is repackaged into a per-cell
* `SqlCodecCallContext` whose `column = { table, name }` is a structural
* projection of the per-cell `ColumnRef = { table, column }` resolved from
* the AST-backed `DecodeContext` (the same resolution `wrapDecodeFailure`
* uses for envelope construction — one resolution per cell, two consumers).
* Cells the runtime cannot resolve to a single underlying column (aggregate
* aliases, computed projections without a simple ref) get
* `column: undefined`, matching the spec contract that the runtime never
* silently defaults this field.
*/
async function decodeField(alias, wireValue, decodeCtx, jsonValidators, rowCtx) {
	if (wireValue === null) return null;
	const codec$1 = decodeCtx.codecs.get(alias);
	if (!codec$1) return wireValue;
	const ref = decodeCtx.columnRefs.get(alias);
	let cellCtx;
	if (ref) cellCtx = {
		...rowCtx,
		column: {
			table: ref.table,
			name: ref.column
		}
	};
	else {
		const { column: _drop, ...rowCtxWithoutColumn } = rowCtx;
		cellCtx = rowCtxWithoutColumn;
	}
	let decoded;
	try {
		decoded = await codec$1.decode(wireValue, cellCtx);
	} catch (error) {
		wrapDecodeFailure(error, alias, ref, codec$1, wireValue);
	}
	if (jsonValidators && ref) try {
		validateJsonValue(jsonValidators, ref.table, ref.column, decoded, "decode", codec$1.id);
	} catch (error) {
		if (isJsonSchemaValidationError(error)) throw error;
		wrapDecodeFailure(error, alias, ref, codec$1, wireValue);
	}
	return decoded;
}
/**
* Decodes a row by dispatching all per-cell codec calls concurrently via
* `Promise.all`. Each cell follows the single-armed `decodeField` path.
* Failures are wrapped in `RUNTIME.DECODE_FAILED` with `{ table, column,
* codec }` (or `{ alias, codec }` when no column ref is resolvable) and the
* original error attached on `cause`.
*
* When `rowCtx.signal` is provided:
*
* - **Already-aborted at entry** short-circuits with `RUNTIME.ABORTED`
*   (`{ phase: 'decode' }`) before any `codec.decode` call is made.
* - **Mid-flight aborts** race the per-cell `Promise.all` against the
*   signal so the runtime returns promptly even when codec bodies ignore
*   it. In-flight bodies that ignore the signal complete in the
*   background (cooperative cancellation).
* - Existing `RUNTIME.DECODE_FAILED` envelopes from codec bodies pass
*   through unchanged (no double wrap).
*/
async function decodeRow(row, plan, registry, jsonValidators, rowCtx, contractCodecs) {
	checkAborted(rowCtx, "decode");
	const signal = rowCtx.signal;
	const decodeCtx = buildDecodeContext(plan, registry, contractCodecs);
	const aliases = decodeCtx.aliases ?? Object.keys(row);
	if (decodeCtx.aliases !== void 0) {
		for (const alias of decodeCtx.aliases) if (!Object.hasOwn(row, alias)) throw runtimeError("RUNTIME.DECODE_FAILED", `Row missing projection alias "${alias}"`, {
			alias,
			expectedAliases: decodeCtx.aliases,
			presentKeys: Object.keys(row)
		});
	}
	const tasks = [];
	const includeIndices = [];
	for (let i = 0; i < aliases.length; i++) {
		const alias = aliases[i];
		const wireValue = row[alias];
		if (decodeCtx.includeAliases.has(alias)) {
			includeIndices.push({
				index: i,
				alias,
				value: wireValue
			});
			tasks.push(Promise.resolve(void 0));
			continue;
		}
		tasks.push(decodeField(alias, wireValue, decodeCtx, jsonValidators, rowCtx));
	}
	const settled = await raceAgainstAbort(Promise.all(tasks), signal, "decode");
	for (const entry of includeIndices) settled[entry.index] = decodeIncludeAggregate(entry.alias, entry.value);
	const decoded = {};
	for (let i = 0; i < aliases.length; i++) decoded[aliases[i]] = settled[i];
	return decoded;
}

//#endregion
//#region src/codecs/encoding.ts
const NO_METADATA = Object.freeze({
	codecId: void 0,
	name: void 0
});
/**
* Resolve the codec for an outgoing param.
*
* Phase B (and AC-5-deferred carve-out): `ParamRef` does not carry a
* `(table, column)` ref today — every `ParamRef` carries `codecId` but
* not the column it relates to. Encode-side dispatch therefore consults
* `contractCodecs.forCodecId(codecId)` (which itself prefers the
* contract-walk-derived shared codec, falling back to the legacy
* `CodecRegistry.get` for parameterized codec ids whose contracts don't
* have a column the walk could resolve through).
*
* For the parameterized codecs shipped at Phase B (pgvector, postgres
* json/jsonb), encode is per-instance-stateless w.r.t. params:
* - pgvector formats `[v1,v2,...]` regardless of declared length;
* - postgres json/jsonb encode is `JSON.stringify` regardless of schema.
*
* So the codec-id-keyed lookup yields a structurally equivalent encoder
* even when the resolved per-instance codec carries extra state (e.g. a
* compiled JSON-Schema validator used only by `decode`). TML-2357 retires
* the fallback by threading `ParamRef.refs` through column-bound
* construction sites.
*/
function resolveParamCodec(metadata, registry, contractCodecs) {
	if (!metadata.codecId) return void 0;
	const fromContract = contractCodecs?.forCodecId(metadata.codecId);
	if (fromContract) return fromContract;
	return registry.get(metadata.codecId);
}
function paramLabel(metadata, paramIndex) {
	return metadata.name ?? `param[${paramIndex}]`;
}
function wrapEncodeFailure(error, metadata, paramIndex, codecId) {
	const label = paramLabel(metadata, paramIndex);
	const wrapped = runtimeError("RUNTIME.ENCODE_FAILED", `Failed to encode parameter ${label} with codec '${codecId}': ${error instanceof Error ? error.message : String(error)}`, {
		label,
		codec: codecId,
		paramIndex
	});
	wrapped.cause = error;
	throw wrapped;
}
async function encodeParamValue(value, metadata, paramIndex, registry, ctx, contractCodecs) {
	if (value === null || value === void 0) return null;
	const codec$1 = resolveParamCodec(metadata, registry, contractCodecs);
	if (!codec$1) return value;
	try {
		return await codec$1.encode(value, ctx);
	} catch (error) {
		wrapEncodeFailure(error, metadata, paramIndex, codec$1.id);
	}
}
/**
* Encodes all parameters concurrently via `Promise.all`. Per parameter, sync-
* and async-authored codecs share the same path: `codec.encode → await →
* return`. Param-level failures are wrapped in `RUNTIME.ENCODE_FAILED`.
*
* When `ctx.signal` is provided:
*
* - **Already-aborted at entry** short-circuits with `RUNTIME.ABORTED`
*   (`{ phase: 'encode' }`) before any `codec.encode` call is made — codecs
*   can pin this with a per-call counter that stays at zero.
* - **Mid-flight abort** races the per-param `Promise.all` against
*   `abortable(ctx.signal)`. The runtime returns `RUNTIME.ABORTED` promptly
*   even if codec bodies ignore the signal; the in-flight bodies are
*   abandoned and run to completion in the background (cooperative
*   cancellation, see ADR 204).
* - Existing `RUNTIME.ENCODE_FAILED` envelopes that surface from a codec
*   body before the runtime observes the abort pass through unchanged
*   (no double wrap).
*/
async function encodeParams(plan, registry, ctx, contractCodecs) {
	checkAborted(ctx, "encode");
	const signal = ctx.signal;
	if (plan.params.length === 0) return plan.params;
	const paramCount = plan.params.length;
	const metadata = new Array(paramCount).fill(NO_METADATA);
	if (plan.ast) {
		const refs = collectOrderedParamRefs(plan.ast);
		for (let i = 0; i < paramCount && i < refs.length; i++) {
			const ref = refs[i];
			if (ref) metadata[i] = {
				codecId: ref.codecId,
				name: ref.name
			};
		}
	}
	const tasks = new Array(paramCount);
	for (let i = 0; i < paramCount; i++) tasks[i] = encodeParamValue(plan.params[i], metadata[i] ?? NO_METADATA, i, registry, ctx, contractCodecs);
	const settled = await raceAgainstAbort(Promise.all(tasks), signal, "encode");
	return Object.freeze(settled);
}

//#endregion
//#region src/fingerprint.ts
const STRING_LITERAL_REGEX = /'(?:''|[^'])*'/g;
const NUMERIC_LITERAL_REGEX = /\b\d+(?:\.\d+)?\b/g;
const WHITESPACE_REGEX = /\s+/g;
/**
* Computes a literal-stripped, normalized fingerprint of a SQL statement.
*
* The function strips string and numeric literals, collapses whitespace, and
* lowercases the result before hashing — so two structurally equivalent
* statements (with different parameter values) produce the same fingerprint.
* Used by SQL telemetry to group queries.
*/
function computeSqlFingerprint(sql) {
	const normalized = sql.replace(STRING_LITERAL_REGEX, "?").replace(NUMERIC_LITERAL_REGEX, "?").replace(WHITESPACE_REGEX, " ").trim().toLowerCase();
	return `sha256:${createHash("sha256").update(normalized).digest("hex")}`;
}

//#endregion
//#region src/middleware/before-compile-chain.ts
async function runBeforeCompileChain(middleware, initial, ctx) {
	let current = initial;
	for (const mw of middleware) {
		if (!mw.beforeCompile) continue;
		const result = await mw.beforeCompile(current, ctx);
		if (result === void 0) continue;
		if (result.ast === current.ast) continue;
		ctx.log.debug?.({
			event: "middleware.rewrite",
			middleware: mw.name,
			lane: current.meta.lane
		});
		current = result;
	}
	return current;
}

//#endregion
//#region src/sql-family-adapter.ts
var SqlFamilyAdapter = class {
	contract;
	markerReader;
	constructor(contract, adapterProfile) {
		this.contract = contract;
		this.markerReader = adapterProfile;
	}
	validatePlan(plan, contract) {
		if (plan.meta.target !== contract.target) throw runtimeError("PLAN.TARGET_MISMATCH", "Plan target does not match runtime target", {
			planTarget: plan.meta.target,
			runtimeTarget: contract.target
		});
		if (plan.meta.storageHash !== contract.storage.storageHash) throw runtimeError("PLAN.HASH_MISMATCH", "Plan storage hash does not match runtime contract", {
			planStorageHash: plan.meta.storageHash,
			runtimeStorageHash: contract.storage.storageHash
		});
	}
};

//#endregion
//#region src/sql-runtime.ts
function isExecutionPlan(plan) {
	return "sql" in plan;
}
var SqlRuntimeImpl = class extends RuntimeCore {
	contract;
	adapter;
	driver;
	familyAdapter;
	codecRegistry;
	contractCodecs;
	codecDescriptors;
	jsonSchemaValidators;
	sqlCtx;
	verify;
	codecRegistryValidated;
	verified;
	startupVerified;
	_telemetry;
	constructor(options) {
		const { context, adapter, driver, verify, middleware, mode, log } = options;
		if (middleware) for (const mw of middleware) checkMiddlewareCompatibility(mw, "sql", context.contract.target);
		const sqlCtx = {
			contract: context.contract,
			mode: mode ?? "strict",
			now: () => Date.now(),
			log: log ?? {
				info: () => {},
				warn: () => {},
				error: () => {}
			}
		};
		super({
			middleware: middleware ?? [],
			ctx: sqlCtx
		});
		this.contract = context.contract;
		this.adapter = adapter;
		this.driver = driver;
		this.familyAdapter = new SqlFamilyAdapter(context.contract, adapter.profile);
		this.codecRegistry = context.codecs;
		this.contractCodecs = context.contractCodecs;
		this.codecDescriptors = context.codecDescriptors;
		this.jsonSchemaValidators = context.jsonSchemaValidators;
		this.sqlCtx = sqlCtx;
		this.verify = verify;
		this.codecRegistryValidated = false;
		this.verified = verify.mode === "startup" ? false : verify.mode === "always";
		this.startupVerified = false;
		this._telemetry = null;
		if (verify.mode === "startup") {
			validateCodecRegistryCompleteness(this.codecDescriptors, context.contract);
			this.codecRegistryValidated = true;
		}
	}
	/**
	* Lower a `SqlQueryPlan` (AST + meta) into a `SqlExecutionPlan` with
	* encoded parameters ready for the driver. This is the single point at
	* which params transition from app-layer values to driver wire-format.
	*
	* `ctx: SqlCodecCallContext` is forwarded to `encodeParams` so per-query
	* cancellation reaches every codec body during parameter encoding. The
	* framework abstract typed this as `CodecCallContext`; the SQL family
	* narrows it to the SQL-specific extension. SQL params do not populate
	* `ctx.column` — encode-side column metadata is the middleware's domain.
	*/
	async lower(plan, ctx) {
		const lowered = lowerSqlPlan(this.adapter, this.contract, plan);
		return Object.freeze({
			...lowered,
			params: await encodeParams(lowered, this.codecRegistry, ctx, this.contractCodecs)
		});
	}
	/**
	* Default driver invocation. Production execution paths override the
	* queryable target (e.g. transaction or connection) by going through
	* `executeAgainstQueryable`; this implementation supports any caller of
	* `super.execute(plan)` and the abstract-base contract.
	*/
	runDriver(exec) {
		return this.driver.execute({
			sql: exec.sql,
			params: exec.params
		});
	}
	/**
	* SQL pre-compile hook. Runs the registered middleware `beforeCompile`
	* chain over the plan's draft (AST + meta). Returns the original plan
	* unchanged when no middleware rewrote the AST; otherwise returns a new
	* plan carrying the rewritten AST and meta. The AST is the authoritative
	* source of execution metadata, so a rewrite needs no sidecar
	* reconciliation here — the lowering adapter and the encoder both walk
	* the rewritten AST directly.
	*/
	async runBeforeCompile(plan) {
		const rewrittenDraft = await runBeforeCompileChain(this.middleware, {
			ast: plan.ast,
			meta: plan.meta
		}, this.sqlCtx);
		return rewrittenDraft.ast === plan.ast ? plan : {
			...plan,
			ast: rewrittenDraft.ast,
			meta: rewrittenDraft.meta
		};
	}
	execute(plan, options) {
		return this.executeAgainstQueryable(plan, this.driver, options);
	}
	executeAgainstQueryable(plan, queryable, options) {
		this.ensureCodecRegistryValidated();
		const self = this;
		const signal = options?.signal;
		const codecCtx = signal === void 0 ? {} : { signal };
		const generator = async function* () {
			checkAborted(codecCtx, "stream");
			const exec = isExecutionPlan(plan) ? Object.freeze({
				...plan,
				params: await encodeParams(plan, self.codecRegistry, codecCtx, self.contractCodecs)
			}) : await self.lower(await self.runBeforeCompile(plan), codecCtx);
			self.familyAdapter.validatePlan(exec, self.contract);
			self._telemetry = null;
			if (!self.startupVerified && self.verify.mode === "startup") await self.verifyMarker();
			if (!self.verified && self.verify.mode === "onFirstUse") await self.verifyMarker();
			const startedAt = Date.now();
			let outcome = null;
			try {
				if (self.verify.mode === "always") await self.verifyMarker();
				const iterator = runWithMiddleware(exec, self.middleware, self.ctx, () => queryable.execute({
					sql: exec.sql,
					params: exec.params
				}))[Symbol.asyncIterator]();
				try {
					while (true) {
						checkAborted(codecCtx, "stream");
						const next = await iterator.next();
						if (next.done) break;
						yield await decodeRow(next.value, exec, self.codecRegistry, self.jsonSchemaValidators, codecCtx, self.contractCodecs);
					}
				} finally {
					await iterator.return?.();
				}
				outcome = "success";
			} catch (error) {
				outcome = "runtime-error";
				throw error;
			} finally {
				if (outcome !== null) self.recordTelemetry(exec, outcome, Date.now() - startedAt);
			}
		};
		return new AsyncIterableResult(generator());
	}
	async connection() {
		const driverConn = await this.driver.acquireConnection();
		const self = this;
		return {
			async transaction() {
				const driverTx = await driverConn.beginTransaction();
				return self.wrapTransaction(driverTx);
			},
			async release() {
				await driverConn.release();
			},
			async destroy(reason) {
				await driverConn.destroy(reason);
			},
			execute(plan, options) {
				return self.executeAgainstQueryable(plan, driverConn, options);
			}
		};
	}
	wrapTransaction(driverTx) {
		const self = this;
		return {
			async commit() {
				await driverTx.commit();
			},
			async rollback() {
				await driverTx.rollback();
			},
			execute(plan, options) {
				return self.executeAgainstQueryable(plan, driverTx, options);
			}
		};
	}
	telemetry() {
		return this._telemetry;
	}
	async close() {
		await this.driver.close();
	}
	ensureCodecRegistryValidated() {
		if (!this.codecRegistryValidated) {
			validateCodecRegistryCompleteness(this.codecDescriptors, this.contract);
			this.codecRegistryValidated = true;
		}
	}
	async verifyMarker() {
		if (this.verify.mode === "always") this.verified = false;
		if (this.verified) return;
		const readStatement = this.familyAdapter.markerReader.readMarkerStatement();
		const result = await this.driver.query(readStatement.sql, readStatement.params);
		if (result.rows.length === 0) {
			if (this.verify.requireMarker) throw runtimeError("CONTRACT.MARKER_MISSING", "Contract marker not found in database");
			this.verified = true;
			return;
		}
		const marker = this.familyAdapter.markerReader.parseMarkerRow(result.rows[0]);
		const contract = this.contract;
		if (marker.storageHash !== contract.storage.storageHash) throw runtimeError("CONTRACT.MARKER_MISMATCH", "Database storage hash does not match contract", {
			expected: contract.storage.storageHash,
			actual: marker.storageHash
		});
		const expectedProfile = contract.profileHash ?? null;
		if (expectedProfile !== null && marker.profileHash !== expectedProfile) throw runtimeError("CONTRACT.MARKER_MISMATCH", "Database profile hash does not match contract", {
			expectedProfile,
			actualProfile: marker.profileHash
		});
		this.verified = true;
		this.startupVerified = true;
	}
	recordTelemetry(plan, outcome, durationMs) {
		const contract = this.contract;
		this._telemetry = Object.freeze({
			lane: plan.meta.lane,
			target: contract.target,
			fingerprint: computeSqlFingerprint(plan.sql),
			outcome,
			...durationMs !== void 0 ? { durationMs } : {}
		});
	}
};
function transactionClosedError() {
	return runtimeError("RUNTIME.TRANSACTION_CLOSED", "Cannot read from a query result after the transaction has ended. Await the result or call .toArray() inside the transaction callback.", {});
}
async function withTransaction(runtime, fn) {
	const connection = await runtime.connection();
	const transaction = await connection.transaction();
	let invalidated = false;
	const txContext = {
		get invalidated() {
			return invalidated;
		},
		execute(plan, options) {
			if (invalidated) throw transactionClosedError();
			const inner = transaction.execute(plan, options);
			const guarded = async function* () {
				for await (const row of inner) {
					if (invalidated) throw transactionClosedError();
					yield row;
				}
			};
			return new AsyncIterableResult(guarded());
		}
	};
	let connectionDisposed = false;
	const destroyConnection = async (reason) => {
		if (connectionDisposed) return;
		connectionDisposed = true;
		await connection.destroy(reason).catch(() => void 0);
	};
	try {
		let result;
		try {
			result = await fn(txContext);
		} catch (error) {
			try {
				await transaction.rollback();
			} catch (rollbackError) {
				await destroyConnection(rollbackError);
				const wrapped = runtimeError("RUNTIME.TRANSACTION_ROLLBACK_FAILED", "Transaction rollback failed after callback error", { rollbackError });
				wrapped.cause = error;
				throw wrapped;
			}
			throw error;
		} finally {
			invalidated = true;
		}
		try {
			await transaction.commit();
		} catch (commitError) {
			try {
				await transaction.rollback();
			} catch {
				await destroyConnection(commitError);
			}
			const wrapped = runtimeError("RUNTIME.TRANSACTION_COMMIT_FAILED", "Transaction commit failed", { commitError });
			wrapped.cause = commitError;
			throw wrapped;
		}
		return result;
	} finally {
		if (!connectionDisposed) await connection.release();
	}
}
function createRuntime(options) {
	const { stackInstance, context, driver, verify, middleware, mode, log } = options;
	return new SqlRuntimeImpl({
		context,
		adapter: stackInstance.adapter,
		driver,
		verify,
		...ifDefined("middleware", middleware),
		...ifDefined("mode", mode),
		...ifDefined("log", log)
	});
}

//#endregion
export { readContractMarker as a, createSqlExecutionStack as c, parseContractMarkerRow as d, lowerSqlPlan as f, validateContractCodecMappings as h, ensureTableStatement as i, lints as l, validateCodecRegistryCompleteness as m, withTransaction as n, writeContractMarker as o, extractCodecIds as p, ensureSchemaStatement as r, createExecutionContext as s, createRuntime as t, budgets as u };
//# sourceMappingURL=exports-CrHMfIKo.mjs.map