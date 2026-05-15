import { AsyncIterableResult } from "@prisma-next/framework-components/runtime";
import { AggregateExpr, AndExpr, BinaryExpr, ColumnRef, DefaultValueExpr, DeleteAst, DerivedTableSource, EqColJoinOn, ExistsExpr, InsertAst, InsertOnConflict, JoinAst, JsonArrayAggExpr, JsonObjectExpr, ListExpression, LiteralExpr, NotExpr, NullCheckExpr, OrExpr, OrderByItem, ParamRef, ProjectionItem, SelectAst, SubqueryExpr, TableSource, UpdateAst, collectOrderedParamRefs, isWhereExpr } from "@prisma-next/sql-relational-core/ast";

//#region src/collection-contract.ts
function modelsOf(contract) {
	return contract.models;
}
function modelOf(contract, name) {
	return modelsOf(contract)[name];
}
const fieldToColumnCache = /* @__PURE__ */ new WeakMap();
const columnToFieldCache = /* @__PURE__ */ new WeakMap();
const polymorphismCache = /* @__PURE__ */ new WeakMap();
function resolvePolymorphismInfo(contract, modelName) {
	let perContract = polymorphismCache.get(contract);
	if (!perContract) {
		perContract = /* @__PURE__ */ new Map();
		polymorphismCache.set(contract, perContract);
	}
	if (perContract.has(modelName)) return perContract.get(modelName);
	const models = modelsOf(contract);
	const model = models[modelName];
	if (!model?.discriminator || !model.variants) {
		perContract.set(modelName, void 0);
		return;
	}
	const baseTable = model.storage?.table;
	if (!baseTable) {
		perContract.set(modelName, void 0);
		return;
	}
	const discriminatorField = model.discriminator.field;
	const discriminatorColumn = resolveFieldToColumn(contract, modelName, discriminatorField);
	const variants = /* @__PURE__ */ new Map();
	const variantsByValue = /* @__PURE__ */ new Map();
	const mtiVariants = [];
	for (const [variantModelName, variantEntry] of Object.entries(model.variants)) {
		const variantModel = models[variantModelName];
		if (!variantModel) throw new Error(`Model "${modelName}" declares variant "${variantModelName}", but that model is missing from the contract`);
		const variantTable = variantModel.storage?.table ?? baseTable;
		const strategy = variantTable === baseTable ? "sti" : "mti";
		const info = {
			modelName: variantModelName,
			value: variantEntry.value,
			table: variantTable,
			strategy
		};
		variants.set(variantModelName, info);
		variantsByValue.set(variantEntry.value, info);
		if (strategy === "mti") mtiVariants.push(info);
	}
	const result = {
		discriminatorField,
		discriminatorColumn,
		baseTable,
		variants,
		variantsByValue,
		mtiVariants
	};
	perContract.set(modelName, result);
	return result;
}
function resolveFieldToColumn(contract, modelName, fieldName) {
	return getFieldToColumnMap(contract, modelName)[fieldName] ?? fieldName;
}
function getFieldToColumnMap(contract, modelName) {
	let perContract = fieldToColumnCache.get(contract);
	if (!perContract) {
		perContract = /* @__PURE__ */ new Map();
		fieldToColumnCache.set(contract, perContract);
	}
	let cached = perContract.get(modelName);
	if (cached) return cached;
	const storageFields = modelsOf(contract)[modelName]?.storage?.fields ?? {};
	cached = {};
	for (const [f, s] of Object.entries(storageFields)) if (s?.column) cached[f] = s.column;
	perContract.set(modelName, cached);
	return cached;
}
function getColumnToFieldMap(contract, modelName) {
	let perContract = columnToFieldCache.get(contract);
	if (!perContract) {
		perContract = /* @__PURE__ */ new Map();
		columnToFieldCache.set(contract, perContract);
	}
	let cached = perContract.get(modelName);
	if (cached) return cached;
	const storageFields = modelsOf(contract)[modelName]?.storage?.fields ?? {};
	cached = {};
	for (const [f, s] of Object.entries(storageFields)) if (s?.column) cached[s.column] = f;
	perContract.set(modelName, cached);
	return cached;
}
const completeColumnToFieldCache = /* @__PURE__ */ new WeakMap();
/**
* Like getColumnToFieldMap but includes identity-mapped fields (where field name equals column
* name). getColumnToFieldMap only returns explicit remaps; this returns ALL column→field entries.
*/
function getCompleteColumnToFieldMap(contract, modelName) {
	let perContract = completeColumnToFieldCache.get(contract);
	if (!perContract) {
		perContract = /* @__PURE__ */ new Map();
		completeColumnToFieldCache.set(contract, perContract);
	}
	let cached = perContract.get(modelName);
	if (cached) return cached;
	const storageFields = modelsOf(contract)[modelName]?.storage?.fields ?? {};
	cached = {};
	for (const [f, s] of Object.entries(storageFields)) cached[s?.column ?? f] = f;
	perContract.set(modelName, cached);
	return cached;
}
function resolveIncludeRelation(contract, modelName, relationName) {
	const relation = resolveModelRelations(contract, modelName)[relationName];
	if (!relation) throw new Error(`Relation '${relationName}' not found on model '${modelName}'`);
	const localField = relation.on.localFields[0];
	const targetField = relation.on.targetFields[0];
	if (!localField || !targetField) throw new Error(`Relation '${relationName}' on model '${modelName}' has incomplete join metadata (missing localFields or targetFields)`);
	const relatedTableName = resolveModelTableName(contract, relation.to);
	const localColumn = resolveFieldToColumn(contract, modelName, localField);
	const targetColumn = resolveFieldToColumn(contract, relation.to, targetField);
	return {
		relatedModelName: relation.to,
		relatedTableName,
		targetColumn,
		localColumn,
		cardinality: relation.cardinality
	};
}
const modelRelationsCache = /* @__PURE__ */ new WeakMap();
function resolveModelRelations(contract, modelName) {
	let perContract = modelRelationsCache.get(contract);
	if (!perContract) {
		perContract = /* @__PURE__ */ new Map();
		modelRelationsCache.set(contract, perContract);
	}
	const cached = perContract.get(modelName);
	if (cached) return cached;
	const relationMap = modelsOf(contract)[modelName]?.relations ?? {};
	const resolved = {};
	for (const [name, value] of Object.entries(relationMap)) {
		if (!value || typeof value !== "object") continue;
		const rel = value;
		const localFields = rel.on?.localFields;
		const targetFields = rel.on?.targetFields;
		if (typeof rel.to !== "string" || !Array.isArray(localFields) || !Array.isArray(targetFields)) continue;
		resolved[name] = {
			to: rel.to,
			cardinality: parseRelationCardinality(rel.cardinality),
			on: {
				localFields,
				targetFields
			}
		};
	}
	perContract.set(modelName, resolved);
	return resolved;
}
function parseRelationCardinality(value) {
	if (value === "1:1" || value === "N:1" || value === "1:N" || value === "M:N") return value;
}
function resolveUpsertConflictColumns(contract, modelName, conflictOn) {
	if (conflictOn && typeof conflictOn === "object") {
		const columns = Object.keys(conflictOn).map((fieldName) => resolveFieldToColumn(contract, modelName, fieldName));
		if (columns.length > 0) return columns;
	}
	const tableName = resolveModelTableName(contract, modelName);
	return [...contract.storage.tables[tableName]?.primaryKey?.columns ?? []];
}
function resolveModelTableName(contract, modelName) {
	const model = modelsOf(contract)[modelName];
	if (!model) throw new Error(`Model "${modelName}" not found in contract`);
	if (model.storage && typeof model.storage.table === "string") return model.storage.table;
	throw new Error(`Model "${modelName}" has invalid or missing storage.table in the contract`);
}
function resolvePrimaryKeyColumn(contract, tableName) {
	return contract.storage.tables[tableName]?.primaryKey?.columns[0] ?? "id";
}
function assertReturningCapability(contract, action) {
	if (hasContractCapability(contract, "returning")) return;
	throw new Error(`${action} requires contract capability "returning"`);
}
function hasContractCapability(contract, capability) {
	const capabilities = contract.capabilities;
	const value = capabilities[capability];
	if (capabilityEnabled(value)) return true;
	return Object.values(capabilities).some((targetCapabilities) => {
		if (typeof targetCapabilities !== "object" || targetCapabilities === null) return false;
		return capabilityEnabled(targetCapabilities[capability]);
	});
}
function capabilityEnabled(value) {
	if (value === true) return true;
	if (typeof value !== "object" || value === null) return false;
	return Object.values(value).some((flag) => flag === true);
}
function isToOneCardinality(cardinality) {
	return cardinality === "1:1" || cardinality === "N:1";
}

//#endregion
//#region src/aggregate-builder.ts
function createAggregateBuilder(contract, modelName) {
	const fieldToColumn = getFieldToColumnMap(contract, modelName);
	return {
		count() {
			return {
				kind: "aggregate",
				fn: "count"
			};
		},
		sum(field) {
			return createFieldAggregateSelector(fieldToColumn, field, "sum");
		},
		avg(field) {
			return createFieldAggregateSelector(fieldToColumn, field, "avg");
		},
		min(field) {
			return createFieldAggregateSelector(fieldToColumn, field, "min");
		},
		max(field) {
			return createFieldAggregateSelector(fieldToColumn, field, "max");
		}
	};
}
function isAggregateSelector(value) {
	if (!value || typeof value !== "object") return false;
	const candidate = value;
	if (candidate.kind !== "aggregate") return false;
	return candidate.fn === "count" || candidate.fn === "sum" || candidate.fn === "avg" || candidate.fn === "min" || candidate.fn === "max";
}
function createFieldAggregateSelector(fieldToColumn, field, fn) {
	const fieldName = field;
	return {
		kind: "aggregate",
		fn,
		column: fieldToColumn[fieldName] ?? fieldName
	};
}

//#endregion
//#region src/collection-aggregate-result.ts
function normalizeAggregateResult(aggregateSpec, row) {
	const result = {};
	for (const [alias, selector] of Object.entries(aggregateSpec)) {
		const value = row[alias];
		if (value === null) {
			result[alias] = null;
			continue;
		}
		if (value === void 0) {
			result[alias] = selector.fn === "count" ? 0 : null;
			continue;
		}
		if (typeof value === "number") {
			result[alias] = value;
			continue;
		}
		if (typeof value === "bigint") {
			result[alias] = Number(value);
			continue;
		}
		if (typeof value === "string") {
			const numeric = Number(value);
			result[alias] = Number.isNaN(numeric) ? value : numeric;
			continue;
		}
		result[alias] = value;
	}
	return result;
}

//#endregion
//#region src/collection-column-mapping.ts
function mapFieldsToColumns(contract, modelName, fieldNames) {
	const fieldToColumn = getFieldToColumnMap(contract, modelName);
	return fieldNames.map((fieldName) => fieldToColumn[fieldName] ?? fieldName);
}
function mapCursorValuesToColumns(contract, modelName, cursorValues) {
	const fieldToColumn = getFieldToColumnMap(contract, modelName);
	const mappedCursor = {};
	for (const [fieldName, value] of Object.entries(cursorValues)) {
		if (value === void 0) continue;
		const columnName = fieldToColumn[fieldName] ?? fieldName;
		mappedCursor[columnName] = value;
	}
	return mappedCursor;
}

//#endregion
//#region src/collection-runtime.ts
function augmentSelectionForJoinColumns(selectedFields, requiredColumns) {
	if (!selectedFields) return {
		selectedForQuery: selectedFields,
		hiddenColumns: []
	};
	const hiddenColumns = requiredColumns.filter((column) => !selectedFields.includes(column));
	if (hiddenColumns.length === 0) return {
		selectedForQuery: selectedFields,
		hiddenColumns: []
	};
	return {
		selectedForQuery: [...selectedFields, ...hiddenColumns],
		hiddenColumns
	};
}
function stripHiddenMappedFields(contract, modelName, mapped, hiddenColumns) {
	if (hiddenColumns.length === 0) return;
	const columnToField = getColumnToFieldMap(contract, modelName);
	for (const hiddenColumn of hiddenColumns) {
		const fieldName = columnToField[hiddenColumn] ?? hiddenColumn;
		delete mapped[fieldName];
	}
}
function createRowEnvelope(contract, modelName, raw) {
	return {
		raw,
		mapped: mapStorageRowToModelFields(contract, modelName, raw)
	};
}
function mapStorageRowToModelFields(contract, modelName, row) {
	const columnToField = getColumnToFieldMap(contract, modelName);
	if (Object.keys(columnToField).length === 0) return { ...row };
	const mapped = {};
	for (const [columnName, value] of Object.entries(row)) mapped[columnToField[columnName] ?? columnName] = value;
	return mapped;
}
const mergedColumnToFieldCache = /* @__PURE__ */ new WeakMap();
function getMergedColumnToFieldMap(contract, baseModelName, variantModelName, variantTable) {
	const cacheKey = `${baseModelName}:${variantModelName}:${variantTable ?? ""}`;
	let perContract = mergedColumnToFieldCache.get(contract);
	if (!perContract) {
		perContract = /* @__PURE__ */ new Map();
		mergedColumnToFieldCache.set(contract, perContract);
	}
	const cached = perContract.get(cacheKey);
	if (cached) return cached;
	const baseMap = getCompleteColumnToFieldMap(contract, baseModelName);
	const variantMap = getCompleteColumnToFieldMap(contract, variantModelName);
	const merged = { ...baseMap };
	for (const [col, field] of Object.entries(variantMap)) if (variantTable) merged[`${variantTable}__${col}`] = field;
	else merged[col] = field;
	perContract.set(cacheKey, merged);
	return merged;
}
function mapPolymorphicRow(contract, baseModelName, polyInfo, row, variantName) {
	const variant = variantName ? polyInfo.variants.get(variantName) : polyInfo.variantsByValue.get(row[polyInfo.discriminatorColumn]);
	if (!variant) {
		const baseMap = getCompleteColumnToFieldMap(contract, baseModelName);
		const mapped$1 = {};
		for (const [col, val] of Object.entries(row)) {
			const field = baseMap[col];
			if (field !== void 0) mapped$1[field] = val;
		}
		return mapped$1;
	}
	const mtiTable = variant.strategy === "mti" ? variant.table : void 0;
	const mergedMap = getMergedColumnToFieldMap(contract, baseModelName, variant.modelName, mtiTable);
	const mapped = {};
	for (const [col, val] of Object.entries(row)) {
		const field = mergedMap[col];
		if (field !== void 0) mapped[field] = val;
	}
	return mapped;
}
function mapModelDataToStorageRow(contract, modelName, row) {
	const fieldToColumn = getFieldToColumnMap(contract, modelName);
	const mapped = {};
	for (const [fieldName, value] of Object.entries(row)) {
		if (value === void 0) continue;
		const columnName = fieldToColumn[fieldName] ?? fieldName;
		mapped[columnName] = value;
	}
	return mapped;
}
function mapResultRows(result, mapper) {
	const generator = async function* () {
		for await (const value of result) yield mapper(value);
	};
	return new AsyncIterableResult(generator());
}
async function acquireRuntimeScope(runtime) {
	if (typeof runtime.connection !== "function") return { scope: runtime };
	const connection = await runtime.connection();
	if (typeof connection.release === "function") return {
		scope: connection,
		release: () => connection.release?.() ?? Promise.resolve()
	};
	return { scope: connection };
}

//#endregion
//#region src/execute-query-plan.ts
function executeQueryPlan(scope, plan) {
	return scope.execute(plan);
}

//#endregion
//#region src/include-strategy.ts
/**
* Choose the SQL emission strategy for nested includes based on the
* contract's declared capabilities.
*
* - `'lateral'`: outer SELECT with one LATERAL JOIN per relation,
*   aggregating to JSON. Requires both `lateral` and `jsonAgg`.
*   Postgres has both.
* - `'correlated'`: outer SELECT with one correlated subquery per
*   relation, aggregating to JSON. Requires `jsonAgg` only.
*   SQLite has `jsonAgg` (via `json_group_array`) but no LATERAL.
* - `'multiQuery'`: fallback. One SELECT per relation, stitched
*   together in JS via `WHERE pk IN (parent-pk-values)`. Always
*   correct; just N+1 round-trips.
*
* The capability flags are looked up under the contract's
* `targetFamily` and `target` namespaces — the two layers the contract
* emitter actually populates. Cross-namespace ("`postgres.lateral`
* found while running SQLite") false positives are impossible because
* we only inspect the running target's namespaces.
*/
function selectIncludeStrategy(contract) {
	const hasLateral = capabilityFlag(contract, "lateral");
	const hasJsonAgg = capabilityFlag(contract, "jsonAgg");
	if (hasLateral && hasJsonAgg) return "lateral";
	if (hasJsonAgg) return "correlated";
	return "multiQuery";
}
/**
* Read a capability flag from the contract's target/family namespaces.
*
* The contract emitter populates `capabilities[targetFamily]` (universal
* SQL flags like `jsonAgg`, `returning`) and `capabilities[target]`
* (target-specific flags like `lateral` on Postgres). Either may
* declare a given flag; the family namespace declares the floor and the
* target namespace can extend on top.
*/
function capabilityFlag(contract, flag) {
	return contract.capabilities[contract.targetFamily]?.[flag] === true || contract.capabilities[contract.target]?.[flag] === true;
}

//#endregion
//#region src/query-plan-meta.ts
function deriveParamsFromAst(ast) {
	return { params: collectOrderedParamRefs(ast).map((p) => p.value) };
}
function resolveTableColumns(contract, tableName) {
	const table = contract.storage.tables[tableName];
	if (!table) throw new Error(`Unknown table "${tableName}" in SQL ORM query planner`);
	return Object.keys(table.columns);
}
function buildOrmPlanMeta(contract) {
	return {
		target: contract.target,
		targetFamily: contract.targetFamily,
		storageHash: contract.storage.storageHash,
		...contract.profileHash !== void 0 ? { profileHash: contract.profileHash } : {},
		lane: "orm-client"
	};
}
function buildOrmQueryPlan(contract, ast, params) {
	return Object.freeze({
		ast,
		params: [...params],
		meta: buildOrmPlanMeta(contract)
	});
}

//#endregion
//#region src/where-utils.ts
function combineWhereExprs(filters) {
	if (filters.length === 0) return;
	if (filters.length === 1) return filters[0];
	return AndExpr.of(filters);
}

//#endregion
//#region src/query-plan-aggregate.ts
function toAggregateProjection(contract, tableName, selector) {
	if (selector.fn === "count") return {
		expr: AggregateExpr.count(),
		codecId: void 0
	};
	if (!selector.column) throw new Error(`Aggregate selector "${selector.fn}" requires a field`);
	const expr = new AggregateExpr(selector.fn, ColumnRef.of(tableName, selector.column));
	if (selector.fn === "min" || selector.fn === "max") return {
		expr,
		codecId: contract.storage.tables[tableName]?.columns[selector.column]?.codecId
	};
	return {
		expr,
		codecId: void 0
	};
}
function validateGroupedComparable(value) {
	switch (value.kind) {
		case "param-ref": throw new Error("ParamRef is not supported in grouped having expressions");
		case "literal":
		case "column-ref":
		case "identifier-ref":
		case "aggregate":
		case "operation": return value;
		case "list":
			if (value.values.some((entry) => entry.kind === "param-ref")) throw new Error("ParamRef is not supported in grouped having expressions");
			return value;
		default: throw new Error(`Unsupported comparable kind in grouped having: "${value.kind}"`);
	}
}
function validateGroupedMetricExpr(expr) {
	if (expr.kind !== "aggregate") throw new Error("groupBy().having() only supports aggregate metric expressions");
	return expr;
}
function rejectHavingExpr(expr) {
	throw new Error(`Unsupported grouped having expression kind "${expr.kind}"`);
}
function validateGroupedHavingExpr(expr) {
	return expr.accept({
		columnRef: rejectHavingExpr,
		identifierRef: rejectHavingExpr,
		subquery: rejectHavingExpr,
		operation: rejectHavingExpr,
		aggregate: rejectHavingExpr,
		jsonObject: rejectHavingExpr,
		jsonArrayAgg: rejectHavingExpr,
		literal: rejectHavingExpr,
		param() {
			throw new Error("ParamRef is not supported in grouped having expressions");
		},
		list: rejectHavingExpr,
		and(expr$1) {
			return AndExpr.of(expr$1.exprs.map((child) => validateGroupedHavingExpr(child)));
		},
		or(expr$1) {
			return OrExpr.of(expr$1.exprs.map((child) => validateGroupedHavingExpr(child)));
		},
		exists(expr$1) {
			throw new Error(`Unsupported grouped having expression kind "${expr$1.kind}"`);
		},
		nullCheck(expr$1) {
			return new NullCheckExpr(validateGroupedMetricExpr(expr$1.expr), expr$1.isNull);
		},
		not(expr$1) {
			return new NotExpr(validateGroupedHavingExpr(expr$1.expr));
		},
		binary(expr$1) {
			return new BinaryExpr(expr$1.op, validateGroupedMetricExpr(expr$1.left), validateGroupedComparable(expr$1.right));
		}
	});
}
function compileAggregate(contract, tableName, filters, aggregateSpec) {
	const entries = Object.entries(aggregateSpec);
	if (entries.length === 0) throw new Error("aggregate() requires at least one aggregation selector");
	const projection = entries.map(([alias, selector]) => {
		const { expr, codecId } = toAggregateProjection(contract, tableName, selector);
		return ProjectionItem.of(alias, expr, codecId);
	});
	let ast = SelectAst.from(TableSource.named(tableName)).withProjection(projection);
	const where = combineWhereExprs(filters);
	if (where) ast = ast.withWhere(where);
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}
function compileGroupedAggregate(contract, tableName, filters, groupByColumns, aggregateSpec, havingExpr) {
	if (groupByColumns.length === 0) throw new Error("groupBy() requires at least one field");
	const entries = Object.entries(aggregateSpec);
	if (entries.length === 0) throw new Error("groupBy().aggregate() requires at least one aggregation selector");
	const table = contract.storage.tables[tableName];
	const projection = [...groupByColumns.map((column) => ProjectionItem.of(column, ColumnRef.of(tableName, column), table?.columns[column]?.codecId)), ...entries.map(([alias, selector]) => {
		const { expr, codecId } = toAggregateProjection(contract, tableName, selector);
		return ProjectionItem.of(alias, expr, codecId);
	})];
	let ast = SelectAst.from(TableSource.named(tableName)).withProjection(projection).withGroupBy(groupByColumns.map((column) => ColumnRef.of(tableName, column)));
	const where = combineWhereExprs(filters);
	if (where) ast = ast.withWhere(where);
	if (havingExpr) ast = ast.withHaving(validateGroupedHavingExpr(havingExpr));
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}

//#endregion
//#region src/query-plan-mutations.ts
function buildReturningColumns(contract, tableName, returningColumns) {
	const columns = returningColumns && returningColumns.length > 0 ? [...returningColumns] : resolveTableColumns(contract, tableName);
	const table = contract.storage.tables[tableName];
	return columns.map((column) => ProjectionItem.of(column, ColumnRef.of(tableName, column), table?.columns[column]?.codecId));
}
function toParamAssignments(contract, tableName, values) {
	const assignments = {};
	const table = contract.storage.tables[tableName];
	if (!table) throw new Error(`Unknown table "${tableName}"`);
	for (const [column, value] of Object.entries(values)) {
		const codecId = table.columns[column]?.codecId;
		if (!codecId) throw new Error(`Unknown column "${column}" in table "${tableName}"`);
		assignments[column] = ParamRef.of(value, {
			name: column,
			codecId
		});
	}
	return { assignments };
}
function normalizeInsertRows(contract, tableName, rows) {
	if (rows.length === 0) throw new Error("normalizeInsertRows requires at least one row");
	const orderedColumns = [];
	const seenColumns = /* @__PURE__ */ new Set();
	for (const row of rows) for (const column of Object.keys(row)) {
		if (seenColumns.has(column)) continue;
		seenColumns.add(column);
		orderedColumns.push(column);
	}
	return { rows: rows.map((row) => {
		if (orderedColumns.length === 0) return {};
		const normalizedRow = {};
		for (const column of orderedColumns) {
			if (Object.hasOwn(row, column)) {
				const table = contract.storage.tables[tableName];
				if (!table) throw new Error(`Unknown table "${tableName}"`);
				const codecId = table?.columns[column]?.codecId;
				if (!codecId) throw new Error(`Unknown column "${column}" in table "${tableName}"`);
				normalizedRow[column] = ParamRef.of(row[column], {
					name: column,
					codecId
				});
				continue;
			}
			normalizedRow[column] = new DefaultValueExpr();
		}
		return normalizedRow;
	}) };
}
function compileInsertReturning(contract, tableName, rows, returningColumns) {
	const { rows: normalizedRows } = normalizeInsertRows(contract, tableName, rows);
	const ast = InsertAst.into(TableSource.named(tableName)).withRows(normalizedRows).withReturning(buildReturningColumns(contract, tableName, returningColumns));
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}
function compileInsertCount(contract, tableName, rows) {
	const { rows: normalizedRows } = normalizeInsertRows(contract, tableName, rows);
	const ast = InsertAst.into(TableSource.named(tableName)).withRows(normalizedRows);
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}
function stripUndefinedValues(row) {
	const result = {};
	for (const [key, value] of Object.entries(row)) if (value !== void 0) result[key] = value;
	return result;
}
function groupRowsByColumnSignature(rows) {
	const groups = [];
	let currentKey = "";
	let currentGroup = [];
	for (const rawRow of rows) {
		const row = stripUndefinedValues(rawRow);
		const key = Object.keys(row).sort().join(",");
		if (key !== currentKey || currentGroup.length === 0) {
			if (currentGroup.length > 0) groups.push(currentGroup);
			currentKey = key;
			currentGroup = [row];
		} else currentGroup.push(row);
	}
	if (currentGroup.length > 0) groups.push(currentGroup);
	return groups;
}
function compileInsertReturningSplit(contract, tableName, rows, returningColumns) {
	if (rows.length === 0) throw new Error("create() requires at least one row");
	return groupRowsByColumnSignature(rows).map((group) => compileInsertReturning(contract, tableName, group, returningColumns));
}
function compileInsertCountSplit(contract, tableName, rows) {
	if (rows.length === 0) throw new Error("createCount() requires at least one row");
	return groupRowsByColumnSignature(rows).map((group) => compileInsertCount(contract, tableName, group));
}
function compileUpsertReturning(contract, tableName, createValues, updateValues, conflictColumns, returningColumns) {
	const createAssignments = toParamAssignments(contract, tableName, createValues);
	const updateAssignments = Object.keys(updateValues).length > 0 ? toParamAssignments(contract, tableName, updateValues) : void 0;
	const onConflict = updateAssignments ? InsertOnConflict.on(conflictColumns.map((column) => ColumnRef.of(tableName, column))).doUpdateSet(updateAssignments.assignments) : InsertOnConflict.on(conflictColumns.map((column) => ColumnRef.of(tableName, column))).doNothing();
	const ast = InsertAst.into(TableSource.named(tableName)).withValues(createAssignments.assignments).withOnConflict(onConflict).withReturning(buildReturningColumns(contract, tableName, returningColumns));
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}
function compileUpdateReturning(contract, tableName, setValues, filters, returningColumns) {
	const where = combineWhereExprs(filters);
	const { assignments } = toParamAssignments(contract, tableName, setValues);
	let ast = UpdateAst.table(TableSource.named(tableName)).withSet(assignments).withReturning(buildReturningColumns(contract, tableName, returningColumns));
	if (where) ast = ast.withWhere(where);
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}
function compileUpdateCount(contract, tableName, setValues, filters) {
	const where = combineWhereExprs(filters);
	const { assignments } = toParamAssignments(contract, tableName, setValues);
	let ast = UpdateAst.table(TableSource.named(tableName)).withSet(assignments);
	if (where) ast = ast.withWhere(where);
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}
function compileDeleteReturning(contract, tableName, filters, returningColumns) {
	const where = combineWhereExprs(filters);
	let ast = DeleteAst.from(TableSource.named(tableName)).withReturning(buildReturningColumns(contract, tableName, returningColumns));
	if (where) ast = ast.withWhere(where);
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}
function compileDeleteCount(contract, tableName, filters) {
	const where = combineWhereExprs(filters);
	let ast = DeleteAst.from(TableSource.named(tableName));
	if (where) ast = ast.withWhere(where);
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}

//#endregion
//#region src/where-binding.ts
function bindWhereExpr(contract, expr) {
	return bindWhereExprNode(contract, expr);
}
function bindWhereExprNode(contract, expr) {
	return expr.accept({
		columnRef(expr$1) {
			return bindExpression(contract, expr$1);
		},
		identifierRef(expr$1) {
			return expr$1;
		},
		subquery(expr$1) {
			return bindExpression(contract, expr$1);
		},
		operation(expr$1) {
			return bindExpression(contract, expr$1);
		},
		aggregate(expr$1) {
			return bindExpression(contract, expr$1);
		},
		jsonObject(expr$1) {
			return bindExpression(contract, expr$1);
		},
		jsonArrayAgg(expr$1) {
			return bindExpression(contract, expr$1);
		},
		literal(expr$1) {
			return expr$1;
		},
		param(expr$1) {
			return expr$1;
		},
		list(expr$1) {
			return bindExpression(contract, expr$1);
		},
		binary(expr$1) {
			const left = bindExpression(contract, expr$1.left);
			const bindingColumn = left.kind === "column-ref" ? left : void 0;
			return new BinaryExpr(expr$1.op, left, bindComparable(contract, expr$1.right, bindingColumn));
		},
		and(expr$1) {
			return AndExpr.of(expr$1.exprs.map((part) => bindWhereExprNode(contract, part)));
		},
		or(expr$1) {
			return OrExpr.of(expr$1.exprs.map((part) => bindWhereExprNode(contract, part)));
		},
		exists(expr$1) {
			return expr$1.notExists ? ExistsExpr.notExists(bindSelectAst(contract, expr$1.subquery)) : ExistsExpr.exists(bindSelectAst(contract, expr$1.subquery));
		},
		nullCheck(expr$1) {
			return expr$1.isNull ? NullCheckExpr.isNull(bindExpression(contract, expr$1.expr)) : NullCheckExpr.isNotNull(bindExpression(contract, expr$1.expr));
		},
		not(expr$1) {
			return new NotExpr(bindWhereExprNode(contract, expr$1.expr));
		}
	});
}
function bindComparable(contract, comparable, bindingColumn) {
	if (comparable.kind === "param-ref" || bindingColumn === void 0) return comparable.kind === "param-ref" ? comparable : comparable.kind === "literal" || comparable.kind === "list" ? comparable : bindExpression(contract, comparable);
	if (comparable.kind === "literal") return createParamRef(contract, bindingColumn, comparable.value);
	if (comparable.kind === "list") return ListExpression.of(comparable.values.map((value) => value.kind === "literal" ? createParamRef(contract, bindingColumn, value.value) : value));
	return bindExpression(contract, comparable);
}
function createParamRef(contract, columnRef, value) {
	const codecId = contract.storage.tables[columnRef.table]?.columns[columnRef.column]?.codecId;
	if (!codecId) throw new Error(`Unknown column "${columnRef.column}" in table "${columnRef.table}"`);
	return ParamRef.of(value, { codecId });
}
function createExpressionBinder(contract) {
	return { select: (ast) => bindSelectAst(contract, ast) };
}
function bindExpression(contract, expr) {
	return expr.rewrite(createExpressionBinder(contract));
}
function bindProjectionExpr(contract, expr) {
	return expr.kind === "literal" ? expr : bindExpression(contract, expr);
}
function bindOrderByItem(contract, orderItem) {
	return new OrderByItem(bindExpression(contract, orderItem.expr), orderItem.dir);
}
function bindJoin(contract, join) {
	return new JoinAst(join.joinType, bindFromSource(contract, join.source), join.on.kind === "eq-col-join-on" ? join.on : bindWhereExprNode(contract, join.on), join.lateral);
}
function bindFromSource(contract, source) {
	if (source.kind === "table-source") return source;
	if (source.kind === "derived-table-source") {
		const derived = source;
		return DerivedTableSource.as(derived.alias, bindSelectAst(contract, derived.query));
	}
	return source;
}
function bindSelectAst(contract, ast) {
	return new SelectAst({
		from: bindFromSource(contract, ast.from),
		joins: ast.joins?.map((join) => bindJoin(contract, join)),
		projection: ast.projection.map((projection) => new ProjectionItem(projection.alias, bindProjectionExpr(contract, projection.expr), projection.codecId)),
		where: ast.where ? bindWhereExprNode(contract, ast.where) : void 0,
		orderBy: ast.orderBy?.map((orderItem) => bindOrderByItem(contract, orderItem)),
		distinct: ast.distinct,
		distinctOn: ast.distinctOn?.map((expr) => bindExpression(contract, expr)),
		groupBy: ast.groupBy?.map((expr) => bindExpression(contract, expr)),
		having: ast.having ? bindWhereExprNode(contract, ast.having) : void 0,
		limit: ast.limit,
		offset: ast.offset,
		selectAllIntent: ast.selectAllIntent
	});
}

//#endregion
//#region src/query-plan-select.ts
function buildProjection(contract, tableName, selectedFields, tableRef = tableName) {
	const columns = selectedFields && selectedFields.length > 0 ? [...selectedFields] : resolveTableColumns(contract, tableName);
	const table = contract.storage.tables[tableName];
	return columns.map((column) => ProjectionItem.of(column, ColumnRef.of(tableRef, column), table?.columns[column]?.codecId));
}
function createBoundaryExpr(tableName, entry) {
	return new BinaryExpr(entry.direction === "asc" ? "gt" : "lt", ColumnRef.of(tableName, entry.column), LiteralExpr.of(entry.value));
}
function buildLexicographicCursorWhere(tableName, entries) {
	const branches = entries.map((entry, index) => {
		const branchExprs = [];
		for (const prefixEntry of entries.slice(0, index)) branchExprs.push(BinaryExpr.eq(ColumnRef.of(tableName, prefixEntry.column), LiteralExpr.of(prefixEntry.value)));
		branchExprs.push(createBoundaryExpr(tableName, entry));
		if (branchExprs.length === 1) return branchExprs[0];
		return AndExpr.of(branchExprs);
	});
	if (branches.length === 1) return branches[0];
	return OrExpr.of(branches);
}
function buildCursorWhere(tableName, orderBy, cursor) {
	if (!cursor || !orderBy || orderBy.length === 0) return;
	const entries = [];
	for (const order of orderBy) {
		if (order.expr.kind !== "column-ref") continue;
		const column = order.expr.column;
		const value = cursor[column];
		if (value === void 0) throw new Error(`Missing cursor value for orderBy column "${column}"`);
		entries.push({
			column,
			direction: order.dir,
			value
		});
	}
	const firstEntry = entries[0];
	if (entries.length === 1 && firstEntry !== void 0) return createBoundaryExpr(tableName, firstEntry);
	return buildLexicographicCursorWhere(tableName, entries);
}
function createTableRefRemapper(fromTable, toTable) {
	return {
		columnRef: (col) => col.table === fromTable ? ColumnRef.of(toTable, col.column) : col,
		tableSource: (source) => {
			if (source.alias === fromTable) return TableSource.named(source.name, toTable);
			if (!source.alias && source.name === fromTable) return TableSource.named(source.name, toTable);
			return source;
		},
		eqColJoinOn: (on) => EqColJoinOn.of(on.left.table === fromTable ? ColumnRef.of(toTable, on.left.column) : on.left, on.right.table === fromTable ? ColumnRef.of(toTable, on.right.column) : on.right)
	};
}
function buildStateWhere(contract, tableName, state, options) {
	const filterTableName = options?.filterTableName;
	const cursorWhere = buildCursorWhere(filterTableName ?? tableName, state.orderBy, state.cursor);
	const remappedFilters = filterTableName && filterTableName !== tableName ? state.filters.map((filter) => filter.rewrite(createTableRefRemapper(filterTableName, tableName))) : state.filters;
	const boundCursorWhere = cursorWhere ? bindWhereExpr(contract, cursorWhere) : void 0;
	const remappedCursorWhere = boundCursorWhere && filterTableName && filterTableName !== tableName ? boundCursorWhere.rewrite(createTableRefRemapper(filterTableName, tableName)) : boundCursorWhere;
	return combineWhereExprs(remappedCursorWhere ? [...remappedFilters, remappedCursorWhere] : remappedFilters);
}
function buildIncludeOrderArtifacts(relationName, rowAlias, childOrderBy) {
	if (!childOrderBy || childOrderBy.length === 0) return {
		childOrderBy: void 0,
		hiddenOrderProjection: [],
		aggregateOrderBy: void 0
	};
	const hiddenOrderProjection = childOrderBy.map((orderItem, index) => ProjectionItem.of(`${relationName}__order_${index}`, orderItem.expr));
	return {
		childOrderBy,
		hiddenOrderProjection,
		aggregateOrderBy: hiddenOrderProjection.map((projection, index) => {
			const orderItem = childOrderBy[index];
			if (!orderItem) throw new Error(`Missing include order metadata at index ${index}`);
			return new OrderByItem(ColumnRef.of(rowAlias, projection.alias), orderItem.dir);
		})
	};
}
function buildIncludeChildRowsSelect(contract, parentTableName, include) {
	const childState = include.nested;
	const childTableAlias = include.relatedTableName === parentTableName ? `${include.relationName}__child` : void 0;
	const childTableRef = childTableAlias ?? include.relatedTableName;
	const rowsAlias = `${include.relationName}__rows`;
	const childProjection = buildProjection(contract, include.relatedTableName, childState.selectedFields, childTableRef);
	const { childOrderBy, hiddenOrderProjection, aggregateOrderBy } = buildIncludeOrderArtifacts(include.relationName, rowsAlias, childState.orderBy);
	const childWhere = buildStateWhere(contract, childTableRef, childState, { filterTableName: include.relatedTableName });
	const joinExpr = BinaryExpr.eq(ColumnRef.of(childTableRef, include.targetColumn), ColumnRef.of(parentTableName, include.localColumn));
	const whereExpr = childWhere ? AndExpr.of([joinExpr, childWhere]) : joinExpr;
	let childRows = SelectAst.from(TableSource.named(include.relatedTableName, childTableAlias)).withProjection([...childProjection, ...hiddenOrderProjection]).withWhere(whereExpr);
	if (childOrderBy) childRows = childRows.withOrderBy(childOrderBy);
	if (childState.distinctOn && childState.distinctOn.length > 0) childRows = childRows.withDistinctOn(childState.distinctOn.map((column) => ColumnRef.of(childTableRef, column)));
	else if (childState.distinct && childState.distinct.length > 0) childRows = childRows.withDistinct(true);
	if (childState.limit !== void 0) childRows = childRows.withLimit(childState.limit);
	if (childState.offset !== void 0) childRows = childRows.withOffset(childState.offset);
	return {
		childRows,
		childProjection,
		rowsAlias,
		aggregateOrderBy
	};
}
function buildLateralIncludeArtifacts(contract, parentTableName, include) {
	const { childRows, childProjection, rowsAlias, aggregateOrderBy } = buildIncludeChildRowsSelect(contract, parentTableName, include);
	const lateralAlias = `${include.relationName}_lateral`;
	const jsonObjectExpr = JsonObjectExpr.fromEntries(childProjection.map((item) => JsonObjectExpr.entry(item.alias, ColumnRef.of(rowsAlias, item.alias))));
	const aggregateQuery = SelectAst.from(DerivedTableSource.as(rowsAlias, childRows)).withProjection([ProjectionItem.of(include.relationName, JsonArrayAggExpr.of(jsonObjectExpr, "emptyArray", aggregateOrderBy))]);
	return {
		join: JoinAst.left(DerivedTableSource.as(lateralAlias, aggregateQuery), AndExpr.true(), true),
		projection: ProjectionItem.of(include.relationName, ColumnRef.of(lateralAlias, include.relationName))
	};
}
function buildCorrelatedIncludeProjection(contract, parentTableName, include) {
	const { childRows, childProjection, rowsAlias, aggregateOrderBy } = buildIncludeChildRowsSelect(contract, parentTableName, include);
	const jsonObjectExpr = JsonObjectExpr.fromEntries(childProjection.map((item) => JsonObjectExpr.entry(item.alias, ColumnRef.of(rowsAlias, item.alias))));
	const aggregateQuery = SelectAst.from(DerivedTableSource.as(rowsAlias, childRows)).withProjection([ProjectionItem.of(include.relationName, JsonArrayAggExpr.of(jsonObjectExpr, "emptyArray", aggregateOrderBy))]);
	return { projection: ProjectionItem.of(include.relationName, SubqueryExpr.of(aggregateQuery)) };
}
function buildSelectAst(contract, tableName, state, options = {}) {
	const projection = [...buildProjection(contract, tableName, state.selectedFields), ...options.includeProjection ?? []];
	const where = options.where ?? buildStateWhere(contract, tableName, state);
	let ast = SelectAst.from(TableSource.named(tableName)).withProjection(projection);
	if (where) ast = ast.withWhere(where);
	if (state.orderBy) ast = ast.withOrderBy(state.orderBy);
	if (state.selectedFields === void 0) ast = ast.withSelectAllIntent({ table: tableName });
	if (state.distinctOn && state.distinctOn.length > 0) ast = ast.withDistinctOn(state.distinctOn.map((column) => ColumnRef.of(tableName, column)));
	else if (state.distinct && state.distinct.length > 0) ast = ast.withDistinct(true);
	if (state.limit !== void 0) ast = ast.withLimit(state.limit);
	if (state.offset !== void 0) ast = ast.withOffset(state.offset);
	if (options.joins && options.joins.length > 0) ast = ast.withJoins(options.joins);
	return ast;
}
function buildMtiJoins(contract, polyInfo, variantName) {
	const joins = [];
	const projection = [];
	const pkColumn = resolvePrimaryKeyColumn(contract, polyInfo.baseTable);
	const variantsToJoin = variantName ? polyInfo.mtiVariants.filter((v) => v.modelName === variantName) : polyInfo.mtiVariants;
	for (const variant of variantsToJoin) {
		const joinType = variantName ? "inner" : "left";
		const joinOn = EqColJoinOn.of(ColumnRef.of(polyInfo.baseTable, pkColumn), ColumnRef.of(variant.table, pkColumn));
		const join = joinType === "inner" ? JoinAst.inner(TableSource.named(variant.table), joinOn) : JoinAst.left(TableSource.named(variant.table), joinOn);
		joins.push(join);
		const variantColumns = resolveTableColumns(contract, variant.table);
		const variantTable = contract.storage.tables[variant.table];
		for (const col of variantColumns) {
			if (col === pkColumn) continue;
			const alias = `${variant.table}__${col}`;
			projection.push(ProjectionItem.of(alias, ColumnRef.of(variant.table, col), variantTable?.columns[col]?.codecId));
		}
	}
	return {
		joins,
		projection
	};
}
function compileSelect(contract, tableName, state, modelName) {
	const polyInfo = modelName ? resolvePolymorphismInfo(contract, modelName) : void 0;
	const mtiArtifacts = polyInfo && polyInfo.mtiVariants.length > 0 ? buildMtiJoins(contract, polyInfo, state.variantName) : void 0;
	const ast = buildSelectAst(contract, tableName, {
		...state,
		includes: []
	}, mtiArtifacts ? {
		joins: mtiArtifacts.joins,
		includeProjection: mtiArtifacts.projection
	} : void 0);
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}
function compileRelationSelect(contract, relatedTableName, targetColumn, parentPks, nestedState) {
	const inFilter = BinaryExpr.in(ColumnRef.of(relatedTableName, targetColumn), ListExpression.fromValues(parentPks));
	return compileSelect(contract, relatedTableName, {
		...nestedState,
		includes: [],
		limit: void 0,
		offset: void 0,
		filters: [bindWhereExpr(contract, inFilter), ...nestedState.filters]
	});
}
function compileSelectWithIncludeStrategy(contract, tableName, state, strategy, modelName) {
	if (state.includes.some((include) => include.scalar !== void 0 || include.combine !== void 0)) throw new Error("single-query include strategy does not support scalar include selectors or combine()");
	const includeJoins = [];
	const includeProjection = [];
	const topLevelWhere = buildStateWhere(contract, tableName, state);
	const polyInfo = modelName ? resolvePolymorphismInfo(contract, modelName) : void 0;
	if (polyInfo && polyInfo.mtiVariants.length > 0) {
		const mtiArtifacts = buildMtiJoins(contract, polyInfo, state.variantName);
		includeJoins.push(...mtiArtifacts.joins);
		includeProjection.push(...mtiArtifacts.projection);
	}
	for (const include of state.includes) {
		if (strategy === "lateral") {
			const artifact$1 = buildLateralIncludeArtifacts(contract, tableName, include);
			includeJoins.push(artifact$1.join);
			includeProjection.push(artifact$1.projection);
			continue;
		}
		const artifact = buildCorrelatedIncludeProjection(contract, tableName, include);
		includeProjection.push(artifact.projection);
	}
	const ast = buildSelectAst(contract, tableName, {
		...state,
		includes: []
	}, {
		joins: includeJoins,
		includeProjection,
		...topLevelWhere ? { where: topLevelWhere } : {}
	});
	const { params } = deriveParamsFromAst(ast);
	return buildOrmQueryPlan(contract, ast, params);
}

//#endregion
//#region src/collection-dispatch.ts
function dispatchCollectionRows(options) {
	const { contract, runtime, state, tableName, modelName } = options;
	const polyInfo = resolvePolymorphismInfo(contract, modelName);
	if (state.includes.length === 0) return mapResultRows(executeQueryPlan(runtime, compileSelect(contract, tableName, state, modelName)), polyInfo ? (rawRow) => mapPolymorphicRow(contract, modelName, polyInfo, rawRow, state.variantName) : (rawRow) => mapStorageRowToModelFields(contract, modelName, rawRow));
	return dispatchWithIncludeStrategy(options);
}
function dispatchWithIncludeStrategy(options) {
	const strategy = selectIncludeStrategy(options.contract);
	if (hasNestedIncludes(options.state.includes) || hasComplexIncludeDescriptors(options.state.includes)) return dispatchWithMultiQueryIncludes(options);
	switch (strategy) {
		case "lateral": return dispatchWithSingleQueryIncludes({
			...options,
			strategy: "lateral"
		});
		case "correlated": return dispatchWithSingleQueryIncludes({
			...options,
			strategy: "correlated"
		});
		default: return dispatchWithMultiQueryIncludes(options);
	}
}
function dispatchWithSingleQueryIncludes(options) {
	const { contract, runtime, state, tableName, modelName, strategy } = options;
	const generator = async function* () {
		const { scope, release } = await acquireRuntimeScope(runtime);
		try {
			const parentJoinColumns = state.includes.map((include) => include.localColumn);
			const { selectedForQuery: parentSelectedForQuery, hiddenColumns: hiddenParentColumns } = augmentSelectionForJoinColumns(state.selectedFields, parentJoinColumns);
			const parentRowsRaw = await executeQueryPlan(scope, compileSelectWithIncludeStrategy(contract, tableName, {
				...state,
				selectedFields: parentSelectedForQuery
			}, strategy, modelName)).toArray();
			if (parentRowsRaw.length === 0) return;
			const polyInfo = resolvePolymorphismInfo(contract, modelName);
			const parentRows = parentRowsRaw.map((row) => {
				return {
					raw: row,
					mapped: polyInfo ? mapPolymorphicRow(contract, modelName, polyInfo, row, state.variantName) : mapStorageRowToModelFields(contract, modelName, row)
				};
			});
			for (const parent of parentRows) {
				for (const include of state.includes) {
					if (include.scalar || include.combine) throw new Error("single-query include strategy does not support scalar include selectors or combine()");
					const mappedChildren = parseIncludedRows(parent.raw[include.relationName]).map((childRow) => mapStorageRowToModelFields(contract, include.relatedModelName, childRow));
					parent.mapped[include.relationName] = coerceSingleQueryIncludeResult(mappedChildren, include.cardinality);
				}
				if (hiddenParentColumns.length > 0) stripHiddenMappedFields(contract, modelName, parent.mapped, hiddenParentColumns);
			}
			for (const row of parentRows) yield row.mapped;
		} finally {
			if (release) await release();
		}
	};
	return new AsyncIterableResult(generator());
}
function dispatchWithMultiQueryIncludes(options) {
	const { contract, runtime, state, tableName, modelName } = options;
	const generator = async function* () {
		const { scope, release } = await acquireRuntimeScope(runtime);
		try {
			const parentJoinColumns = state.includes.map((include) => include.localColumn);
			const { selectedForQuery: parentSelectedForQuery, hiddenColumns: hiddenParentColumns } = augmentSelectionForJoinColumns(state.selectedFields, parentJoinColumns);
			const parentRowsRaw = await executeQueryPlan(scope, compileSelect(contract, tableName, {
				...state,
				includes: [],
				selectedFields: parentSelectedForQuery
			}, modelName)).toArray();
			if (parentRowsRaw.length === 0) return;
			const polyInfo = resolvePolymorphismInfo(contract, modelName);
			const parentRows = parentRowsRaw.map((row) => {
				return {
					raw: row,
					mapped: polyInfo ? mapPolymorphicRow(contract, modelName, polyInfo, row, state.variantName) : mapStorageRowToModelFields(contract, modelName, row)
				};
			});
			await stitchIncludes(scope, contract, parentRows, state.includes);
			if (hiddenParentColumns.length > 0) for (const row of parentRows) stripHiddenMappedFields(contract, modelName, row.mapped, hiddenParentColumns);
			for (const row of parentRows) yield row.mapped;
		} finally {
			if (release) await release();
		}
	};
	return new AsyncIterableResult(generator());
}
async function stitchIncludes(scope, contract, parentRows, includes) {
	for (const include of includes) {
		const parentJoinValues = uniqueValues(parentRows.map((row) => row.raw[include.localColumn]).filter((value) => value !== void 0));
		if (parentJoinValues.length === 0) {
			assignEmptyIncludeResult(parentRows, include);
			continue;
		}
		if (include.combine) {
			await stitchCombinedInclude(scope, contract, parentRows, include, parentJoinValues);
			continue;
		}
		if (include.scalar) {
			await stitchScalarInclude(scope, contract, parentRows, include, include.scalar, parentJoinValues);
			continue;
		}
		await stitchRowInclude(scope, contract, parentRows, include, include.nested, parentJoinValues);
	}
}
async function stitchCombinedInclude(scope, contract, parentRows, include, parentJoinValues) {
	const branches = include.combine ?? {};
	for (const parent of parentRows) parent.mapped[include.relationName] = {};
	for (const [branchName, branch] of Object.entries(branches)) {
		if (branch.kind === "rows") {
			const rowsByParent = await resolveRowsByParent(scope, contract, include, branch.state, parentJoinValues);
			for (const parent of parentRows) {
				const parentJoinValue = parent.raw[include.localColumn];
				const relatedRows = rowsByParent.get(parentJoinValue) ?? [];
				const combined = parent.mapped[include.relationName];
				combined[branchName] = coerceIncludeResult(relatedRows, branch.state, include.cardinality);
			}
			continue;
		}
		const scalarByParent = await resolveScalarByParent(scope, contract, include, branch.selector, parentJoinValues);
		for (const parent of parentRows) {
			const parentJoinValue = parent.raw[include.localColumn];
			const combined = parent.mapped[include.relationName];
			combined[branchName] = scalarByParent.get(parentJoinValue) ?? emptyScalarResult(branch.selector.fn);
		}
	}
}
async function stitchScalarInclude(scope, contract, parentRows, include, selector, parentJoinValues) {
	const scalarByParent = await resolveScalarByParent(scope, contract, include, selector, parentJoinValues);
	for (const parent of parentRows) {
		const parentJoinValue = parent.raw[include.localColumn];
		parent.mapped[include.relationName] = scalarByParent.get(parentJoinValue) ?? emptyScalarResult(selector.fn);
	}
}
async function stitchRowInclude(scope, contract, parentRows, include, state, parentJoinValues) {
	const rowsByParent = await resolveRowsByParent(scope, contract, include, state, parentJoinValues);
	for (const parent of parentRows) {
		const parentJoinValue = parent.raw[include.localColumn];
		const relatedRows = rowsByParent.get(parentJoinValue) ?? [];
		parent.mapped[include.relationName] = coerceIncludeResult(relatedRows, state, include.cardinality);
	}
}
async function resolveRowsByParent(scope, contract, include, state, parentJoinValues) {
	const { selectedForQuery: childSelectedForQuery, hiddenColumns: hiddenChildColumns } = augmentSelectionForJoinColumns(state.selectedFields, [include.targetColumn]);
	const childRows = (await executeQueryPlan(scope, compileRelationSelect(contract, include.relatedTableName, include.targetColumn, parentJoinValues, {
		...state,
		selectedFields: childSelectedForQuery
	})).toArray()).map((row) => createRowEnvelope(contract, include.relatedModelName, row));
	if (state.includes.length > 0) await stitchIncludes(scope, contract, childRows, state.includes);
	const childByParentJoin = /* @__PURE__ */ new Map();
	for (const child of childRows) {
		const joinValue = child.raw[include.targetColumn];
		if (hiddenChildColumns.length > 0) stripHiddenMappedFields(contract, include.relatedModelName, child.mapped, hiddenChildColumns);
		let bucket = childByParentJoin.get(joinValue);
		if (!bucket) {
			bucket = [];
			childByParentJoin.set(joinValue, bucket);
		}
		bucket.push(child.mapped);
	}
	return childByParentJoin;
}
async function resolveScalarByParent(scope, contract, include, selector, parentJoinValues) {
	const requiredColumns = selector.column ? [include.targetColumn, selector.column] : [include.targetColumn];
	const { selectedForQuery } = augmentSelectionForJoinColumns(selector.state.selectedFields, requiredColumns);
	const childRowsRaw = await executeQueryPlan(scope, compileRelationSelect(contract, include.relatedTableName, include.targetColumn, parentJoinValues, {
		...selector.state,
		selectedFields: selectedForQuery,
		includes: []
	})).toArray();
	const rowsByParent = /* @__PURE__ */ new Map();
	for (const row of childRowsRaw) {
		const joinValue = row[include.targetColumn];
		let bucket = rowsByParent.get(joinValue);
		if (!bucket) {
			bucket = [];
			rowsByParent.set(joinValue, bucket);
		}
		bucket.push(row);
	}
	const scalarByParent = /* @__PURE__ */ new Map();
	for (const [joinValue, rows] of rowsByParent) {
		const scopedRows = slicePerParent(rows, selector.state);
		scalarByParent.set(joinValue, computeScalarValue(selector, scopedRows));
	}
	return scalarByParent;
}
function uniqueValues(values) {
	return [...new Set(values)];
}
function hasNestedIncludes(includes) {
	return includes.some((include) => include.nested.includes.length > 0);
}
function hasComplexIncludeDescriptors(includes) {
	return includes.some((include) => include.scalar !== void 0 || include.combine !== void 0);
}
function assignEmptyIncludeResult(parentRows, include) {
	if (include.combine) {
		for (const parent of parentRows) {
			const combined = {};
			for (const [branchName, branch] of Object.entries(include.combine)) combined[branchName] = branch.kind === "rows" ? emptyIncludeResult(include.cardinality) : emptyScalarResult(branch.selector.fn);
			parent.mapped[include.relationName] = combined;
		}
		return;
	}
	if (include.scalar) {
		for (const parent of parentRows) parent.mapped[include.relationName] = emptyScalarResult(include.scalar.fn);
		return;
	}
	for (const parent of parentRows) parent.mapped[include.relationName] = emptyIncludeResult(include.cardinality);
}
function parseIncludedRows(value) {
	if (value === null || value === void 0) return [];
	const parsed = parseIncludePayload(value);
	if (!Array.isArray(parsed)) return [];
	const rows = [];
	for (const item of parsed) {
		if (typeof item !== "object" || item === null) continue;
		rows.push({ ...item });
	}
	return rows;
}
function parseIncludePayload(value) {
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return [];
	}
}
function coerceSingleQueryIncludeResult(rows, cardinality) {
	return isToOneCardinality(cardinality) ? rows[0] ?? null : rows;
}
function slicePerParent(rows, state) {
	const offset = state.offset ?? 0;
	if (state.limit === void 0) return rows.slice(offset);
	return rows.slice(offset, offset + state.limit);
}
function emptyIncludeResult(cardinality) {
	return isToOneCardinality(cardinality) ? null : [];
}
function coerceIncludeResult(rows, state, cardinality) {
	const sliced = slicePerParent(rows, state);
	return isToOneCardinality(cardinality) ? sliced[0] ?? null : sliced;
}
function emptyScalarResult(fn) {
	return fn === "count" ? 0 : null;
}
function computeScalarValue(selector, rows) {
	if (selector.fn === "count") return rows.length;
	const column = selector.column;
	if (!column) return null;
	const numericValues = rows.map((row) => coerceNumericValue(row[column])).filter((value) => value !== null);
	if (numericValues.length === 0) return null;
	if (selector.fn === "sum") return numericValues.reduce((total, value) => total + value, 0);
	if (selector.fn === "avg") return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
	if (selector.fn === "min") return Math.min(...numericValues);
	if (selector.fn === "max") return Math.max(...numericValues);
	return null;
}
function coerceNumericValue(value) {
	if (value === null || value === void 0) return null;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") {
		const numeric = Number(value);
		return Number.isNaN(numeric) ? null : numeric;
	}
	return null;
}

//#endregion
//#region src/collection-mutation-dispatch.ts
function dispatchMutationRows(options) {
	const { contract, runtime, compiled, modelName, includes, hiddenColumns, mapRow } = options;
	if (includes.length === 0) return mapResultRows(executeQueryPlan(runtime, compiled), (rawRow) => {
		const mapped = mapStorageRowToModelFields(contract, modelName, rawRow);
		if (hiddenColumns.length > 0) stripHiddenMappedFields(contract, modelName, mapped, hiddenColumns);
		return mapRow(mapped);
	});
	const generator = async function* () {
		const { scope, release } = await acquireRuntimeScope(runtime);
		try {
			const rawRows = await executeQueryPlan(scope, compiled).toArray();
			if (rawRows.length === 0) return;
			const wrappedRows = rawRows.map((row) => createRowEnvelope(contract, modelName, row));
			await stitchIncludes(scope, contract, wrappedRows, includes);
			for (const row of wrappedRows) {
				if (hiddenColumns.length > 0) stripHiddenMappedFields(contract, modelName, row.mapped, hiddenColumns);
				yield mapRow(row.mapped);
			}
		} finally {
			if (release) await release();
		}
	};
	return new AsyncIterableResult(generator());
}
function dispatchSplitMutationRows(options) {
	const { contract, runtime, plans, tableName, includes, hiddenColumns, mapRow } = options;
	const generator = async function* () {
		if (includes.length > 0) {
			const { scope, release } = await acquireRuntimeScope(runtime);
			try {
				const allRawRows = [];
				for (const plan of plans) {
					const rows = await executeQueryPlan(scope, plan).toArray();
					allRawRows.push(...rows);
				}
				if (allRawRows.length === 0) return;
				const wrappedRows = allRawRows.map((row) => createRowEnvelope(contract, tableName, row));
				await stitchIncludes(scope, contract, wrappedRows, includes);
				for (const row of wrappedRows) {
					if (hiddenColumns.length > 0) stripHiddenMappedFields(contract, tableName, row.mapped, hiddenColumns);
					yield mapRow(row.mapped);
				}
			} finally {
				if (release) await release();
			}
		} else for (const plan of plans) {
			const rows = await executeQueryPlan(runtime, plan).toArray();
			for (const rawRow of rows) {
				const mapped = mapStorageRowToModelFields(contract, tableName, rawRow);
				if (hiddenColumns.length > 0) stripHiddenMappedFields(contract, tableName, mapped, hiddenColumns);
				yield mapRow(mapped);
			}
		}
	};
	return new AsyncIterableResult(generator());
}
async function executeMutationReturningSingleRow(options) {
	const { contract, runtime, compiled, modelName, includes, hiddenColumns, mapRow, onMissingRowMessage } = options;
	if (includes.length === 0) {
		const first = (await executeQueryPlan(runtime, compiled).toArray())[0];
		if (!first) return null;
		const mapped = mapStorageRowToModelFields(contract, modelName, first);
		if (hiddenColumns.length > 0) stripHiddenMappedFields(contract, modelName, mapped, hiddenColumns);
		return mapRow(mapped);
	}
	const { scope, release } = await acquireRuntimeScope(runtime);
	try {
		const first = (await executeQueryPlan(scope, compiled).toArray())[0];
		if (!first) return null;
		const wrappedRows = [createRowEnvelope(contract, modelName, first)];
		await stitchIncludes(scope, contract, wrappedRows, includes);
		const result = wrappedRows[0];
		if (!result) throw new Error(onMissingRowMessage);
		if (hiddenColumns.length > 0) stripHiddenMappedFields(contract, modelName, result.mapped, hiddenColumns);
		return mapRow(result.mapped);
	} finally {
		if (release) await release();
	}
}

//#endregion
//#region src/filters.ts
function and(...exprs) {
	return AndExpr.of(exprs);
}
function or(...exprs) {
	return OrExpr.of(exprs);
}
function not(expr) {
	return expr.not();
}
function all() {
	return AndExpr.true();
}
function shorthandToWhereExpr(context, modelName, filters) {
	const contract = context.contract;
	const tableName = resolveModelTableName(contract, modelName);
	const fieldToColumn = getFieldToColumnMap(contract, modelName);
	const exprs = [];
	for (const [fieldName, value] of Object.entries(filters)) {
		if (value === void 0) continue;
		const columnName = fieldToColumn[fieldName] ?? fieldName;
		const left = ColumnRef.of(tableName, columnName);
		if (value === null) {
			exprs.push(NullCheckExpr.isNull(left));
			continue;
		}
		assertFieldHasEqualityTrait(context, modelName, fieldName);
		exprs.push(BinaryExpr.eq(left, LiteralExpr.of(value)));
	}
	if (exprs.length === 0) return;
	return exprs.length === 1 ? exprs[0] : and(...exprs);
}
function assertFieldHasEqualityTrait(context, modelName, fieldName) {
	const fieldType = modelOf(context.contract, modelName)?.fields?.[fieldName]?.type;
	const codecId = fieldType?.kind === "scalar" ? fieldType.codecId : void 0;
	if (!(codecId ? context.codecDescriptors.descriptorFor(codecId)?.traits ?? [] : []).includes("equality")) throw new Error(`Shorthand filter on "${modelName}.${fieldName}": field does not support equality comparisons`);
}

//#endregion
//#region src/grouped-collection.ts
var GroupedCollection = class GroupedCollection {
	ctx;
	contract;
	modelName;
	tableName;
	baseFilters;
	groupByFields;
	groupByColumns;
	havingFilters;
	constructor(ctx, modelName, options) {
		this.ctx = ctx;
		this.contract = ctx.context.contract;
		this.modelName = modelName;
		this.tableName = options.tableName;
		this.baseFilters = options.baseFilters;
		this.groupByFields = options.groupByFields;
		this.groupByColumns = options.groupByColumns;
		this.havingFilters = options.havingFilters;
	}
	having(predicate) {
		const havingExpr = predicate(createHavingBuilder(this.contract, this.modelName, this.tableName));
		return new GroupedCollection(this.ctx, this.modelName, {
			tableName: this.tableName,
			baseFilters: this.baseFilters,
			groupByFields: this.groupByFields,
			groupByColumns: this.groupByColumns,
			havingFilters: [...this.havingFilters, havingExpr]
		});
	}
	async aggregate(fn) {
		const aggregateSpec = fn(createAggregateBuilder(this.contract, this.modelName));
		const aggregateEntries = Object.entries(aggregateSpec);
		if (aggregateEntries.length === 0) throw new Error("groupBy().aggregate() requires at least one aggregation selector");
		for (const [alias, selector] of aggregateEntries) if (!isAggregateSelector(selector)) throw new Error(`groupBy().aggregate() selector "${alias}" is invalid`);
		const compiled = compileGroupedAggregate(this.contract, this.tableName, this.baseFilters, this.groupByColumns, aggregateSpec, combineWhereExprs(this.havingFilters));
		return (await executeQueryPlan(this.ctx.runtime, compiled).toArray()).map((row) => {
			const mapped = mapStorageRowToModelFields(this.contract, this.modelName, row);
			for (const [alias, selector] of aggregateEntries) mapped[alias] = coerceAggregateValue(selector.fn, row[alias]);
			return mapped;
		});
	}
};
function createHavingBuilder(contract, modelName, tableName) {
	const fieldToColumn = getFieldToColumnMap(contract, modelName);
	const createMetricExpr = (fn, fieldName) => new AggregateExpr(fn, ColumnRef.of(tableName, fieldToColumn[fieldName] ?? fieldName));
	return {
		count() {
			return createHavingComparisonMethods(AggregateExpr.count());
		},
		sum(field) {
			return createHavingComparisonMethods(createMetricExpr("sum", field));
		},
		avg(field) {
			return createHavingComparisonMethods(createMetricExpr("avg", field));
		},
		min(field) {
			return createHavingComparisonMethods(createMetricExpr("min", field));
		},
		max(field) {
			return createHavingComparisonMethods(createMetricExpr("max", field));
		}
	};
}
function createHavingComparisonMethods(metric) {
	const buildBinaryExpr = (op, value) => new BinaryExpr(op, metric, LiteralExpr.of(value));
	return {
		eq(value) {
			return buildBinaryExpr("eq", value);
		},
		neq(value) {
			return buildBinaryExpr("neq", value);
		},
		gt(value) {
			return buildBinaryExpr("gt", value);
		},
		lt(value) {
			return buildBinaryExpr("lt", value);
		},
		gte(value) {
			return buildBinaryExpr("gte", value);
		},
		lte(value) {
			return buildBinaryExpr("lte", value);
		}
	};
}
function coerceAggregateValue(fn, value) {
	if (value === null) return null;
	if (value === void 0) return fn === "count" ? 0 : null;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") {
		const numeric = Number(value);
		return Number.isNaN(numeric) ? value : numeric;
	}
	return value;
}

//#endregion
//#region src/include-descriptors.ts
const aggregateFns = new Set([
	"count",
	"sum",
	"avg",
	"min",
	"max"
]);
function createIncludeScalar(fn, state, column) {
	return {
		kind: "includeScalar",
		fn,
		state,
		...column !== void 0 ? { column } : {}
	};
}
function createIncludeCombine(branches) {
	return {
		kind: "includeCombine",
		branches
	};
}
function isIncludeScalar(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	return candidate.kind === "includeScalar" && typeof candidate.fn === "string" && aggregateFns.has(candidate.fn) && isCollectionState(candidate.state);
}
function isIncludeCombine(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	if (candidate.kind !== "includeCombine") return false;
	if (typeof candidate.branches !== "object" || candidate.branches === null) return false;
	return true;
}
function isCollectionStateCarrier(value) {
	if (typeof value !== "object" || value === null) return false;
	return isCollectionState(value.state);
}
function isCollectionState(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	return Array.isArray(candidate.filters) && Array.isArray(candidate.includes);
}

//#endregion
//#region src/types.ts
function emptyState() {
	return {
		filters: [],
		includes: [],
		orderBy: void 0,
		cursor: void 0,
		distinct: void 0,
		distinctOn: void 0,
		selectedFields: void 0,
		limit: void 0,
		offset: void 0,
		variantName: void 0
	};
}
function param(codecId, value) {
	return codecId ? ParamRef.of(value, { codecId }) : ParamRef.of(value);
}
function paramList(codecId, values) {
	return ListExpression.of(values.map((value) => param(codecId, value)));
}
function scalarComparisonMethod(op) {
	return ((left, codecId) => (value) => new BinaryExpr(op, left, param(codecId, value)));
}
function listComparisonMethod(op) {
	return ((left, codecId) => (values) => new BinaryExpr(op, left, paramList(codecId, values)));
}
/**
* Declares trait requirements and runtime factory for each comparison method.
*
* - `traits: []` means "no trait required" — always available
* - Multi-trait: `traits: ['equality', 'order']` means BOTH traits are required
*/
const COMPARISON_METHODS_META = {
	eq: {
		traits: ["equality"],
		create: scalarComparisonMethod("eq")
	},
	neq: {
		traits: ["equality"],
		create: scalarComparisonMethod("neq")
	},
	in: {
		traits: ["equality"],
		create: listComparisonMethod("in")
	},
	notIn: {
		traits: ["equality"],
		create: listComparisonMethod("notIn")
	},
	gt: {
		traits: ["order"],
		create: scalarComparisonMethod("gt")
	},
	lt: {
		traits: ["order"],
		create: scalarComparisonMethod("lt")
	},
	gte: {
		traits: ["order"],
		create: scalarComparisonMethod("gte")
	},
	lte: {
		traits: ["order"],
		create: scalarComparisonMethod("lte")
	},
	like: {
		traits: ["textual"],
		create: scalarComparisonMethod("like")
	},
	asc: {
		traits: ["order"],
		create: (left) => () => OrderByItem.asc(left)
	},
	desc: {
		traits: ["order"],
		create: (left) => () => OrderByItem.desc(left)
	},
	isNull: {
		traits: [],
		create: (left) => () => NullCheckExpr.isNull(left)
	},
	isNotNull: {
		traits: [],
		create: (left) => () => NullCheckExpr.isNotNull(left)
	}
};

//#endregion
//#region src/model-accessor.ts
function createModelAccessor(context, modelName) {
	const contract = context.contract;
	const fieldToColumn = getFieldToColumnMap(contract, modelName);
	const tableName = resolveModelTableName(contract, modelName);
	const modelRelations = modelOf(contract, modelName)?.relations ?? {};
	const opsByCodecId = /* @__PURE__ */ new Map();
	function registerOp(codecId, op) {
		let existing = opsByCodecId.get(codecId);
		if (!existing) {
			existing = [];
			opsByCodecId.set(codecId, existing);
		}
		existing.push(op);
	}
	for (const [name, entry] of Object.entries(context.queryOperations.entries())) {
		const op = [name, entry];
		const self = entry.self;
		if (!self) continue;
		if (self.codecId !== void 0) registerOp(self.codecId, op);
		else if (self.traits !== void 0) for (const descriptor of context.codecDescriptors.values()) {
			const descriptorTraits = descriptor.traits;
			if (self.traits.every((t) => descriptorTraits.includes(t))) registerOp(descriptor.codecId, op);
		}
	}
	return new Proxy({}, { get(_target, prop) {
		if (typeof prop !== "string") return;
		const relation = modelRelations[prop];
		if (relation) return createRelationFilterAccessor(context, modelName, tableName, relation);
		const columnName = fieldToColumn[prop] ?? prop;
		const column = resolveColumn(contract, tableName, columnName);
		if (!column) return;
		const traits = context.codecDescriptors.descriptorFor(column.codecId)?.traits ?? [];
		const operations = opsByCodecId.get(column.codecId) ?? [];
		return createScalarFieldAccessor(tableName, columnName, column.codecId, column.nullable, traits, operations, context);
	} });
}
function resolveColumn(contract, tableName, columnName) {
	const column = contract.storage.tables?.[tableName]?.columns?.[columnName];
	if (!column) return void 0;
	return {
		codecId: column.codecId,
		nullable: column.nullable
	};
}
function createScalarFieldAccessor(tableName, columnName, codecId, nullable, traits, operations, context) {
	const column = ColumnRef.of(tableName, columnName);
	const comparisonEntries = [];
	for (const [name, meta] of Object.entries(COMPARISON_METHODS_META)) {
		if (meta.traits.some((t) => !traits.includes(t))) continue;
		comparisonEntries.push([name, meta.create(column, codecId)]);
	}
	const accessor = {
		returnType: {
			codecId,
			nullable
		},
		buildAst: () => column,
		...Object.fromEntries(comparisonEntries)
	};
	for (const [name, entry] of operations) accessor[name] = createExtensionMethodFactory(accessor, entry, context);
	return accessor;
}
function createExtensionMethodFactory(selfExpr, entry, context) {
	return (...args) => {
		const impl = entry.impl;
		const result = impl(selfExpr, ...args);
		const returnCodecId = result.returnType.codecId;
		const returnTraits = context.codecDescriptors.descriptorFor(returnCodecId)?.traits ?? [];
		if (returnTraits.includes("boolean")) return result.buildAst();
		const resultAst = result.buildAst();
		const methods = {};
		for (const [resultMethodName, meta] of Object.entries(COMPARISON_METHODS_META)) {
			if (meta.traits.some((t) => !returnTraits.includes(t))) continue;
			methods[resultMethodName] = meta.create(resultAst, returnCodecId);
		}
		return methods;
	};
}
function createRelationFilterAccessor(context, parentModelName, parentTableName, relation) {
	const relatedTableName = resolveModelTableName(context.contract, relation.to);
	return {
		some: (predicate) => buildExistsExpr(context, parentModelName, parentTableName, relatedTableName, relation, {
			mode: "some",
			predicate
		}),
		every: (predicate) => buildExistsExpr(context, parentModelName, parentTableName, relatedTableName, relation, {
			mode: "every",
			predicate
		}),
		none: (predicate) => buildExistsExpr(context, parentModelName, parentTableName, relatedTableName, relation, {
			mode: "none",
			predicate
		})
	};
}
function buildExistsExpr(context, parentModelName, parentTableName, relatedTableName, relation, options) {
	const joinWhere = buildJoinWhere(context.contract, parentModelName, parentTableName, relatedTableName, relation);
	const childWhere = toRelationWhereExpr(context, relation.to, options.predicate);
	let subqueryWhere = joinWhere;
	let existsNot = false;
	if (options.mode === "every") {
		if (!childWhere) return AndExpr.true();
		existsNot = true;
		subqueryWhere = and(joinWhere, not(childWhere));
	} else if (options.mode === "none") {
		existsNot = true;
		if (childWhere) subqueryWhere = and(joinWhere, childWhere);
	} else if (childWhere) subqueryWhere = and(joinWhere, childWhere);
	const selectProjectionColumn = firstTargetColumn(context.contract, relation) ?? "id";
	const subquery = SelectAst.from(TableSource.named(relatedTableName)).withProjection([ProjectionItem.of("_exists", ColumnRef.of(relatedTableName, selectProjectionColumn))]).withWhere(subqueryWhere);
	return existsNot ? ExistsExpr.notExists(subquery) : ExistsExpr.exists(subquery);
}
function toRelationWhereExpr(context, relatedModelName, predicate) {
	if (!predicate) return;
	const accessor = createModelAccessor(context, relatedModelName);
	if (typeof predicate === "function") return predicate(accessor);
	const exprs = [];
	for (const [fieldName, value] of Object.entries(predicate)) {
		if (value === void 0) continue;
		const fieldAccessor = accessor[fieldName];
		if (!fieldAccessor) throw new Error(`Shorthand filter on "${relatedModelName}.${fieldName}": field is not defined on the model`);
		if (value === null) {
			if (!fieldAccessor.isNull) throw new Error(`Shorthand filter on "${relatedModelName}.${fieldName}": isNull is unexpectedly missing — this is a bug in trait gating`);
			exprs.push(fieldAccessor.isNull());
			continue;
		}
		if (!fieldAccessor.eq) throw new Error(`Shorthand filter on "${relatedModelName}.${fieldName}": field does not support equality comparisons`);
		exprs.push(fieldAccessor.eq(value));
	}
	if (exprs.length === 0) return;
	return exprs.length === 1 ? exprs[0] : and(...exprs);
}
function buildJoinWhere(contract, parentModelName, parentTableName, relatedTableName, relation) {
	const localFields = relation.on?.localFields ?? [];
	const targetFields = relation.on?.targetFields ?? [];
	const joinExprs = [];
	const count = Math.min(localFields.length, targetFields.length);
	for (let i = 0; i < count; i++) {
		const localField = localFields[i];
		const targetField = targetFields[i];
		if (!localField || !targetField) continue;
		const localColumn = resolveFieldToColumn(contract, parentModelName, localField);
		const targetColumn = resolveFieldToColumn(contract, relation.to, targetField);
		joinExprs.push(BinaryExpr.eq(ColumnRef.of(relatedTableName, targetColumn), ColumnRef.of(parentTableName, localColumn)));
	}
	if (joinExprs.length === 0) throw new Error("Relation metadata is missing join columns");
	const firstExpr = joinExprs[0];
	if (joinExprs.length === 1 && firstExpr !== void 0) return firstExpr;
	return and(...joinExprs);
}
function firstTargetColumn(contract, relation) {
	const firstField = (relation.on?.targetFields)?.[0];
	if (!firstField) return;
	return resolveFieldToColumn(contract, relation.to, firstField);
}

//#endregion
//#region src/relation-mutator.ts
function createRelationMutator() {
	return {
		create(data) {
			return {
				kind: "create",
				data: Array.isArray(data) ? [...data] : [data]
			};
		},
		connect(criteria) {
			return {
				kind: "connect",
				criteria: Array.isArray(criteria) ? [...criteria] : [criteria]
			};
		},
		disconnect(criteria) {
			if (!criteria) return { kind: "disconnect" };
			return {
				kind: "disconnect",
				criteria: [...criteria]
			};
		}
	};
}
function isRelationMutationDescriptor(value) {
	if (!value || typeof value !== "object") return false;
	const candidate = value;
	if (candidate.kind !== "create" && candidate.kind !== "connect" && candidate.kind !== "disconnect") return false;
	return true;
}
function isRelationMutationCallback(value) {
	return typeof value === "function";
}

//#endregion
//#region src/mutation-executor.ts
function hasNestedMutationCallbacks(contract, modelName, data) {
	const relationNames = new Set(getRelationDefinitions(contract, modelName).map((relation) => relation.relationName));
	for (const [fieldName, value] of Object.entries(data)) {
		if (!relationNames.has(fieldName)) continue;
		if (isRelationMutationCallback(value)) return true;
	}
	return false;
}
async function executeNestedCreateMutation(options) {
	return withMutationScope(options.runtime, async (scope) => createGraph(scope, options.context, options.modelName, options.data));
}
async function executeNestedUpdateMutation(options) {
	return withMutationScope(options.runtime, async (scope) => updateFirstGraph(scope, options.context, options.modelName, options.filters, options.data));
}
function buildPrimaryKeyFilterFromRow(contract, modelName, row) {
	const fieldName = toFieldName(contract, modelName, resolvePrimaryKeyColumn(contract, resolveModelTableName(contract, modelName)));
	const value = row[fieldName];
	if (value === void 0) throw new Error(`Missing primary key field "${fieldName}" while reloading model "${modelName}"`);
	return { [fieldName]: value };
}
async function withMutationScope(runtime, run) {
	if (typeof runtime.transaction === "function") {
		const transaction = await runtime.transaction();
		try {
			const result = await run(transaction);
			if (typeof transaction.commit === "function") await transaction.commit();
			return result;
		} catch (error) {
			if (typeof transaction.rollback === "function") await transaction.rollback();
			throw error;
		}
	}
	const { scope, release } = await acquireRuntimeScope(runtime);
	try {
		return await run(scope);
	} finally {
		if (release) await release();
	}
}
async function createGraph(scope, context, modelName, input) {
	const contract = context.contract;
	const parsed = parseMutationInput(contract, modelName, input);
	const { parentOwned, childOwned } = partitionByOwnership(parsed.relationMutations);
	const scalarData = { ...parsed.scalarData };
	for (const relationMutation of parentOwned) {
		if (relationMutation.mutation.kind === "disconnect") throw new Error("disconnect() is only supported in update() nested mutations");
		await applyParentOwnedMutation(scope, context, modelName, scalarData, relationMutation.relation, relationMutation.mutation);
	}
	const parentRow = await insertSingleRow(scope, context, modelName, scalarData);
	for (const relationMutation of childOwned) {
		if (relationMutation.mutation.kind === "disconnect") throw new Error("disconnect() is only supported in update() nested mutations");
		await applyChildOwnedMutation(scope, context, modelName, parentRow, relationMutation.relation, relationMutation.mutation);
	}
	return parentRow;
}
async function updateFirstGraph(scope, context, modelName, filters, input) {
	const contract = context.contract;
	const existingRow = await findFirstByFilters(scope, contract, modelName, filters);
	if (!existingRow) return null;
	const parsed = parseMutationInput(contract, modelName, input);
	const { parentOwned, childOwned } = partitionByOwnership(parsed.relationMutations);
	const scalarData = { ...parsed.scalarData };
	for (const relationMutation of parentOwned) await applyParentOwnedMutation(scope, context, modelName, scalarData, relationMutation.relation, relationMutation.mutation);
	let parentRow = existingRow;
	const mappedUpdateData = mapModelDataToStorageRow(contract, modelName, scalarData);
	if (Object.keys(mappedUpdateData).length > 0) {
		const pkWhere = shorthandToWhereExpr(context, modelName, buildPrimaryKeyFilterFromRow(contract, modelName, existingRow));
		if (!pkWhere) throw new Error(`Failed to build primary key filter for model "${modelName}"`);
		const updatedRaw = (await executeQueryPlan(scope, compileUpdateReturning(contract, resolveModelTableName(contract, modelName), mappedUpdateData, [pkWhere], void 0)).toArray())[0];
		if (updatedRaw) parentRow = mapStorageRowToModelFields(contract, modelName, updatedRaw);
	}
	for (const relationMutation of childOwned) await applyChildOwnedMutation(scope, context, modelName, parentRow, relationMutation.relation, relationMutation.mutation);
	return parentRow;
}
function parseMutationInput(contract, modelName, input) {
	const scalarData = {};
	const relationDefinitions = new Map(getRelationDefinitions(contract, modelName).map((relation) => [relation.relationName, relation]));
	const relationMutations = [];
	for (const [fieldName, value] of Object.entries(input)) {
		const relation = relationDefinitions.get(fieldName);
		if (!relation) {
			scalarData[fieldName] = value;
			continue;
		}
		if (!isRelationMutationCallback(value)) throw new Error(`Relation field "${fieldName}" on model "${modelName}" expects a mutator callback`);
		const mutation = value(createRelationMutator());
		if (!isRelationMutationDescriptor(mutation)) throw new Error(`Relation field "${fieldName}" on model "${modelName}" returned an invalid mutation descriptor`);
		relationMutations.push({
			relation,
			mutation
		});
	}
	return {
		scalarData,
		relationMutations
	};
}
function partitionByOwnership(relationMutations) {
	const parentOwned = [];
	const childOwned = [];
	for (const relationMutation of relationMutations) {
		if (relationMutation.relation.cardinality === "N:1") {
			parentOwned.push(relationMutation);
			continue;
		}
		if (relationMutation.relation.cardinality === "M:N") throw new Error("M:N nested mutations are not supported yet");
		childOwned.push(relationMutation);
	}
	return {
		parentOwned,
		childOwned
	};
}
async function applyParentOwnedMutation(scope, context, parentModelName, scalarData, relation, mutation) {
	const contract = context.contract;
	if (mutation.kind === "disconnect") {
		for (const localColumn of relation.localColumns) {
			const parentFieldName = toFieldName(contract, parentModelName, localColumn);
			scalarData[parentFieldName] = null;
		}
		return;
	}
	if (mutation.kind === "create") {
		const row = mutation.data[0];
		if (!row) throw new Error(`create() nested mutation for relation "${relation.relationName}" requires data`);
		copyRelatedValuesToParent(contract, parentModelName, relation, scalarData, await createGraph(scope, context, relation.relatedModelName, row));
		return;
	}
	const criterion = mutation.criteria[0];
	if (!criterion) throw new Error(`connect() nested mutation for relation "${relation.relationName}" requires criterion`);
	const relatedRow = await findRowByCriterion(scope, context, relation.relatedModelName, criterion);
	if (!relatedRow) throw new Error(`connect() nested mutation for relation "${relation.relationName}" did not find a matching row`);
	copyRelatedValuesToParent(contract, parentModelName, relation, scalarData, relatedRow);
}
function copyRelatedValuesToParent(contract, parentModelName, relation, scalarData, relatedRow) {
	for (let i = 0; i < relation.localColumns.length; i++) {
		const localColumn = relation.localColumns[i];
		const targetColumn = relation.targetColumns[i];
		if (!localColumn || !targetColumn) continue;
		const parentFieldName = toFieldName(contract, parentModelName, localColumn);
		scalarData[parentFieldName] = relatedRow[toFieldName(contract, relation.relatedModelName, targetColumn)];
	}
}
async function applyChildOwnedMutation(scope, context, parentModelName, parentRow, relation, mutation) {
	const contract = context.contract;
	const parentValues = readParentColumnValues(contract, parentModelName, relation, parentRow);
	if (mutation.kind === "create") {
		for (const childInput of mutation.data) {
			const payload = { ...childInput };
			for (const [childColumn, parentValue] of parentValues.entries()) {
				const childFieldName = toFieldName(contract, relation.relatedModelName, childColumn);
				payload[childFieldName] = parentValue;
			}
			await createGraph(scope, context, relation.relatedModelName, payload);
		}
		return;
	}
	if (mutation.kind === "connect") {
		for (const criterion of mutation.criteria) {
			const criterionWhere = shorthandToWhereExpr(context, relation.relatedModelName, criterion);
			if (!criterionWhere) throw new Error(`connect() nested mutation for relation "${relation.relationName}" requires non-empty criterion`);
			const setValues$1 = {};
			for (const [childColumn, parentValue] of parentValues.entries()) setValues$1[childColumn] = parentValue;
			await executeUpdateCount(scope, contract, relation.relatedTableName, setValues$1, [criterionWhere]);
		}
		return;
	}
	const setValues = {};
	for (const childColumn of parentValues.keys()) setValues[childColumn] = null;
	if (!mutation.criteria || mutation.criteria.length === 0) {
		const parentJoinWhere = buildChildJoinWhere(relation, parentValues);
		await executeUpdateCount(scope, contract, relation.relatedTableName, setValues, [parentJoinWhere]);
		return;
	}
	for (const criterion of mutation.criteria) {
		const criterionWhere = shorthandToWhereExpr(context, relation.relatedModelName, criterion);
		if (!criterionWhere) throw new Error(`disconnect() nested mutation for relation "${relation.relationName}" requires non-empty criterion`);
		const parentJoinWhere = buildChildJoinWhere(relation, parentValues);
		await executeUpdateCount(scope, contract, relation.relatedTableName, setValues, [and(parentJoinWhere, criterionWhere)]);
	}
}
function readParentColumnValues(contract, parentModelName, relation, parentRow) {
	const values = /* @__PURE__ */ new Map();
	for (let i = 0; i < relation.localColumns.length; i++) {
		const localColumn = relation.localColumns[i];
		const targetColumn = relation.targetColumns[i];
		if (!localColumn || !targetColumn) continue;
		const parentFieldName = toFieldName(contract, parentModelName, localColumn);
		const parentValue = parentRow[parentFieldName];
		if (parentValue === void 0) throw new Error(`Nested mutation requires parent field "${parentFieldName}" to be present in returned row`);
		values.set(targetColumn, parentValue);
	}
	return values;
}
function buildChildJoinWhere(relation, childValues) {
	const exprs = [];
	for (const [childColumn, parentValue] of childValues.entries()) exprs.push(BinaryExpr.eq(ColumnRef.of(relation.relatedTableName, childColumn), LiteralExpr.of(parentValue)));
	const first = exprs[0];
	if (exprs.length === 1 && first !== void 0) return first;
	return and(...exprs);
}
async function insertSingleRow(scope, context, modelName, data) {
	const contract = context.contract;
	const tableName = resolveModelTableName(contract, modelName);
	const mappedData = mapModelDataToStorageRow(contract, modelName, data);
	const applied = context.applyMutationDefaults({
		op: "create",
		table: tableName,
		values: mappedData
	});
	for (const def of applied) mappedData[def.column] = def.value;
	const firstRow = (await executeQueryPlan(scope, compileInsertReturning(contract, tableName, [mappedData], void 0)).toArray())[0];
	if (!firstRow) throw new Error(`Nested create for model "${modelName}" did not return a row`);
	return mapStorageRowToModelFields(contract, modelName, firstRow);
}
async function findRowByCriterion(scope, context, modelName, criterion) {
	const contract = context.contract;
	const whereExpr = shorthandToWhereExpr(context, modelName, criterion);
	if (!whereExpr) throw new Error(`Nested connect for model "${modelName}" requires non-empty criterion`);
	const firstRow = (await executeQueryPlan(scope, compileSelect(contract, resolveModelTableName(contract, modelName), {
		...emptyState(),
		filters: [whereExpr],
		limit: 1
	})).toArray())[0];
	if (!firstRow) return null;
	return mapStorageRowToModelFields(contract, modelName, firstRow);
}
async function findFirstByFilters(scope, contract, modelName, filters) {
	const firstRow = (await executeQueryPlan(scope, compileSelect(contract, resolveModelTableName(contract, modelName), {
		...emptyState(),
		filters,
		limit: 1
	})).toArray())[0];
	if (!firstRow) return null;
	return mapStorageRowToModelFields(contract, modelName, firstRow);
}
async function executeUpdateCount(scope, contract, tableName, setValues, filters) {
	await executeQueryPlan(scope, compileUpdateCount(contract, tableName, setValues, filters)).toArray();
}
const relationDefsCache = /* @__PURE__ */ new WeakMap();
function getRelationDefinitions(contract, modelName) {
	let perContract = relationDefsCache.get(contract);
	if (!perContract) {
		perContract = /* @__PURE__ */ new Map();
		relationDefsCache.set(contract, perContract);
	}
	const cached = perContract.get(modelName);
	if (cached) return cached;
	const relations = resolveModelRelations(contract, modelName);
	const definitions = Object.entries(relations).map(([relationName, relation]) => ({
		relationName,
		relatedModelName: relation.to,
		relatedTableName: resolveModelTableName(contract, relation.to),
		cardinality: relation.cardinality,
		localColumns: relation.on.localFields.map((f) => resolveFieldToColumn(contract, modelName, f)),
		targetColumns: relation.on.targetFields.map((f) => resolveFieldToColumn(contract, relation.to, f))
	}));
	perContract.set(modelName, definitions);
	return definitions;
}
function toFieldName(contract, modelName, columnName) {
	return getColumnToFieldMap(contract, modelName)[columnName] ?? columnName;
}

//#endregion
//#region src/where-interop.ts
function normalizeWhereArg(arg, options) {
	if (arg === void 0) return;
	if (arg === null) throw new Error("WhereArg cannot be null. Pass undefined or a valid WhereExpr/ToWhereExpr payload.");
	if (isToWhereExpr(arg)) return arg.toWhereExpr();
	if (options?.contract) return bindWhereExpr(options.contract, arg);
	return arg;
}
function isToWhereExpr(arg) {
	return typeof arg === "object" && arg !== null && "toWhereExpr" in arg && !isWhereExpr(arg);
}

//#endregion
//#region src/collection.ts
function applyCreateDefaults(ctx, tableName, rows) {
	for (const row of rows) {
		const applied = ctx.context.applyMutationDefaults({
			op: "create",
			table: tableName,
			values: row
		});
		for (const def of applied) row[def.column] = def.value;
	}
}
function isToWhereExprInput(value) {
	return typeof value === "object" && value !== null && "toWhereExpr" in value && typeof value.toWhereExpr === "function";
}
function isWhereDirectInput(value) {
	return isWhereExpr(value) && typeof value.accept === "function" || isToWhereExprInput(value);
}
var Collection = class Collection {
	/** @internal */
	ctx;
	/** @internal */
	contract;
	/** @internal */
	modelName;
	/** @internal */
	tableName;
	/** @internal */
	state;
	/** @internal */
	registry;
	/** @internal */
	includeRefinementMode;
	constructor(ctx, modelName, options = {}) {
		this.ctx = ctx;
		this.contract = ctx.context.contract;
		this.modelName = modelName;
		this.tableName = options.tableName ?? resolveModelTableName(this.contract, modelName);
		this.state = options.state ?? emptyState();
		this.registry = options.registry ?? /* @__PURE__ */ new Map();
		this.includeRefinementMode = options.includeRefinementMode ?? false;
	}
	where(input) {
		const filter = normalizeWhereArg(typeof input === "function" ? input(createModelAccessor(this.ctx.context, this.modelName)) : isWhereDirectInput(input) ? input : shorthandToWhereExpr(this.ctx.context, this.modelName, input), { contract: this.contract });
		if (!filter) return this;
		return this.#clone({ filters: [...this.state.filters, filter] });
	}
	variant(variantName) {
		const model = this.contract.models[this.modelName];
		const discriminator = model?.["discriminator"];
		const variants = model?.["variants"];
		if (!discriminator || !variants) return this;
		const variantEntry = variants[variantName];
		if (!variantEntry) return this;
		const columnName = resolveFieldToColumn(this.contract, this.modelName, discriminator.field);
		const filter = BinaryExpr.eq(ColumnRef.of(this.tableName, columnName), LiteralExpr.of(variantEntry.value));
		const filtersWithoutPreviousVariant = this.state.variantName ? this.state.filters.filter((f) => !(f instanceof BinaryExpr && f.left instanceof ColumnRef && f.left.column === columnName && f.left.table === this.tableName)) : this.state.filters;
		return this.#cloneWithRow({
			filters: [...filtersWithoutPreviousVariant, filter],
			variantName
		});
	}
	include(relationName, refineFn) {
		const relation = resolveIncludeRelation(this.contract, this.modelName, relationName);
		let nestedState = emptyState();
		let scalarSelector;
		let combineBranches;
		if (refineFn) {
			const refined = refineFn(this.#createCollection(relation.relatedModelName, {
				tableName: relation.relatedTableName,
				state: emptyState(),
				includeRefinementMode: true
			}));
			if (isIncludeScalar(refined)) {
				if (isToOneCardinality(relation.cardinality)) throw new Error(`include('${relationName}') scalar aggregations are only supported for to-many relations`);
				scalarSelector = refined;
				nestedState = refined.state;
			} else if (isIncludeCombine(refined)) {
				if (isToOneCardinality(relation.cardinality)) throw new Error(`include('${relationName}') combine() is only supported for to-many relations`);
				combineBranches = refined.branches;
			} else if (isCollectionStateCarrier(refined)) nestedState = refined.state;
			else throw new Error(`include('${relationName}') refinement must return a collection, include scalar selector, or combine() descriptor`);
		}
		const includeExpr = {
			relationName,
			relatedModelName: relation.relatedModelName,
			relatedTableName: relation.relatedTableName,
			targetColumn: relation.targetColumn,
			localColumn: relation.localColumn,
			cardinality: relation.cardinality,
			nested: nestedState,
			scalar: scalarSelector,
			combine: combineBranches
		};
		return this.#cloneWithRow({ includes: [...this.state.includes, includeExpr] });
	}
	select(...fields) {
		const selectedFields = mapFieldsToColumns(this.contract, this.modelName, fields);
		return this.#cloneWithRow({ selectedFields });
	}
	orderBy(selection) {
		const accessor = createModelAccessor(this.ctx.context, this.modelName);
		const nextOrders = (Array.isArray(selection) ? selection : [selection]).map((selector) => selector(accessor));
		const existing = this.state.orderBy ?? [];
		return this.#clone({ orderBy: [...existing, ...nextOrders] });
	}
	groupBy(...fields) {
		const groupByColumns = mapFieldsToColumns(this.contract, this.modelName, fields);
		return new GroupedCollection(this.ctx, this.modelName, {
			tableName: this.tableName,
			baseFilters: this.state.filters,
			groupByFields: [...fields],
			groupByColumns,
			havingFilters: []
		});
	}
	count() {
		this.#assertIncludeRefinementMode("count()");
		return createIncludeScalar("count", this.state);
	}
	sum(field) {
		this.#assertIncludeRefinementMode("sum()");
		const columnName = resolveFieldToColumn(this.contract, this.modelName, field);
		return createIncludeScalar("sum", this.state, columnName);
	}
	avg(field) {
		this.#assertIncludeRefinementMode("avg()");
		const columnName = resolveFieldToColumn(this.contract, this.modelName, field);
		return createIncludeScalar("avg", this.state, columnName);
	}
	min(field) {
		this.#assertIncludeRefinementMode("min()");
		const columnName = resolveFieldToColumn(this.contract, this.modelName, field);
		return createIncludeScalar("min", this.state, columnName);
	}
	max(field) {
		this.#assertIncludeRefinementMode("max()");
		const columnName = resolveFieldToColumn(this.contract, this.modelName, field);
		return createIncludeScalar("max", this.state, columnName);
	}
	combine(spec) {
		this.#assertIncludeRefinementMode("combine()");
		const branches = {};
		for (const [name, value] of Object.entries(spec)) {
			if (isIncludeScalar(value)) {
				branches[name] = {
					kind: "scalar",
					selector: value
				};
				continue;
			}
			if (isCollectionStateCarrier(value)) {
				branches[name] = {
					kind: "rows",
					state: value.state
				};
				continue;
			}
			throw new Error(`include().combine() branch "${name}" is invalid`);
		}
		return createIncludeCombine(branches);
	}
	cursor(cursorValues) {
		const mappedCursor = mapCursorValuesToColumns(this.contract, this.modelName, cursorValues);
		if (Object.keys(mappedCursor).length === 0) return this;
		return this.#clone({ cursor: mappedCursor });
	}
	distinct(...fields) {
		const distinctFields = mapFieldsToColumns(this.contract, this.modelName, fields);
		return this.#clone({
			distinct: distinctFields,
			distinctOn: void 0
		});
	}
	distinctOn(...fields) {
		const distinctOnFields = mapFieldsToColumns(this.contract, this.modelName, fields);
		return this.#clone({
			distinct: void 0,
			distinctOn: distinctOnFields
		});
	}
	take(n) {
		return this.#clone({ limit: n });
	}
	skip(n) {
		return this.#clone({ offset: n });
	}
	all() {
		return this.#dispatch();
	}
	async first(filter) {
		return (await (filter === void 0 ? this : typeof filter === "function" ? this.where(filter) : this.where(filter)).take(1).#dispatch().toArray())[0] ?? null;
	}
	async aggregate(fn) {
		const aggregateSpec = fn(createAggregateBuilder(this.contract, this.modelName));
		const entries = Object.entries(aggregateSpec);
		if (entries.length === 0) throw new Error("aggregate() requires at least one aggregation selector");
		for (const [alias, selector] of entries) if (!isAggregateSelector(selector)) throw new Error(`aggregate() selector "${alias}" is invalid`);
		const compiled = compileAggregate(this.contract, this.tableName, this.state.filters, aggregateSpec);
		return normalizeAggregateResult(aggregateSpec, (await executeQueryPlan(this.ctx.runtime, compiled).toArray())[0] ?? {});
	}
	async create(data) {
		assertReturningCapability(this.contract, "create()");
		if (hasNestedMutationCallbacks(this.contract, this.modelName, data)) {
			const createdRow = await executeNestedCreateMutation({
				context: this.ctx.context,
				runtime: this.ctx.runtime,
				modelName: this.modelName,
				data
			});
			const pkCriterion = buildPrimaryKeyFilterFromRow(this.contract, this.modelName, createdRow);
			const reloaded = await this.#reloadMutationRowByPrimaryKey(pkCriterion);
			if (!reloaded) throw new Error(`create() for model "${this.modelName}" did not return a row`);
			return reloaded;
		}
		const created = (await this.createAll([data]))[0];
		if (created) return created;
		throw new Error(`create() for model "${this.modelName}" did not return a row`);
	}
	createAll(data) {
		if (data.length === 0) {
			const generator = async function* () {};
			return new AsyncIterableResult(generator());
		}
		assertReturningCapability(this.contract, "createAll()");
		const rows = data;
		const mtiContext = this.#resolveMtiCreateContext();
		if (mtiContext) return this.#executeMtiCreate(rows, mtiContext);
		const mappedRows = this.#mapCreateRows(rows);
		applyCreateDefaults(this.ctx, this.tableName, mappedRows);
		const parentJoinColumns = this.state.includes.map((include) => include.localColumn);
		const { selectedForQuery: selectedForInsert, hiddenColumns } = augmentSelectionForJoinColumns(this.state.selectedFields, parentJoinColumns);
		if (this.contract.capabilities?.["sql"]?.["defaultInInsert"] !== true) {
			const plans = compileInsertReturningSplit(this.contract, this.tableName, mappedRows, selectedForInsert);
			return dispatchSplitMutationRows({
				contract: this.contract,
				runtime: this.ctx.runtime,
				plans,
				tableName: this.tableName,
				includes: this.state.includes,
				hiddenColumns,
				mapRow: (mapped) => mapped
			});
		}
		const compiled = compileInsertReturning(this.contract, this.tableName, mappedRows, selectedForInsert);
		return dispatchMutationRows({
			contract: this.contract,
			runtime: this.ctx.runtime,
			compiled,
			modelName: this.modelName,
			includes: this.state.includes,
			hiddenColumns,
			mapRow: (mapped) => mapped
		});
	}
	#assertNotMtiVariant(method) {
		if (this.#resolveMtiCreateContext()) throw new Error(`${method} is not supported for MTI variant "${this.state.variantName}" on model "${this.modelName}". Use createAll() instead.`);
	}
	#resolveMtiCreateContext() {
		const variantName = this.state.variantName;
		if (!variantName) return null;
		const polyInfo = resolvePolymorphismInfo(this.contract, this.modelName);
		if (!polyInfo) return null;
		const variant = polyInfo.variants.get(variantName);
		if (!variant || variant.strategy !== "mti") return null;
		return {
			polyInfo,
			variant,
			baseFieldToColumn: getFieldToColumnMap(this.contract, this.modelName),
			variantFieldToColumn: getFieldToColumnMap(this.contract, variant.modelName),
			pkColumn: resolvePrimaryKeyColumn(this.contract, this.tableName)
		};
	}
	#executeMtiCreate(data, mtiCtx) {
		const { polyInfo, variant, baseFieldToColumn, variantFieldToColumn, pkColumn } = mtiCtx;
		const contract = this.contract;
		const collectionCtx = this.ctx;
		const runtime = collectionCtx.runtime;
		const tableName = this.tableName;
		const modelName = this.modelName;
		const baseFieldColumns = new Set(Object.values(baseFieldToColumn));
		const variantFieldColumns = new Set(Object.values(variantFieldToColumn));
		const mergedFieldToColumn = {
			...baseFieldToColumn,
			...variantFieldToColumn
		};
		const generator = async function* () {
			for (const row of data) {
				const allMapped = {};
				for (const [fieldName, value] of Object.entries(row)) {
					if (value === void 0) continue;
					const columnName = mergedFieldToColumn[fieldName] ?? fieldName;
					allMapped[columnName] = value;
				}
				allMapped[polyInfo.discriminatorColumn] = variant.value;
				const baseRow = {};
				const variantRow = {};
				for (const [col, val] of Object.entries(allMapped)) {
					if (baseFieldColumns.has(col) || col === polyInfo.discriminatorColumn) baseRow[col] = val;
					if (variantFieldColumns.has(col)) variantRow[col] = val;
				}
				yield await withMutationScope(runtime, async (scope) => {
					applyCreateDefaults(collectionCtx, tableName, [baseRow]);
					const baseCreated = (await executeQueryPlan(scope, compileInsertReturning(contract, tableName, [baseRow], void 0)).toArray())[0];
					if (!baseCreated) throw new Error(`MTI base INSERT for model "${modelName}" did not return a row`);
					variantRow[pkColumn] = baseCreated[pkColumn];
					applyCreateDefaults(collectionCtx, variant.table, [variantRow]);
					const variantCreated = (await executeQueryPlan(scope, compileInsertReturning(contract, variant.table, [variantRow], void 0)).toArray())[0];
					if (!variantCreated) throw new Error(`MTI variant INSERT for model "${modelName}" into "${variant.table}" did not return a row`);
					const prefixedVariant = {};
					for (const [col, val] of Object.entries(variantCreated)) {
						if (col === pkColumn) continue;
						prefixedVariant[`${variant.table}__${col}`] = val;
					}
					return mapPolymorphicRow(contract, modelName, polyInfo, {
						...baseCreated,
						...prefixedVariant
					}, variant.modelName);
				});
			}
		};
		return new AsyncIterableResult(generator());
	}
	#mapCreateRows(data) {
		const variantName = this.state.variantName;
		if (!variantName) return data.map((row) => mapModelDataToStorageRow(this.contract, this.modelName, row));
		const polyInfo = resolvePolymorphismInfo(this.contract, this.modelName);
		if (!polyInfo) return data.map((row) => mapModelDataToStorageRow(this.contract, this.modelName, row));
		const variant = polyInfo.variants.get(variantName);
		if (!variant) return data.map((row) => mapModelDataToStorageRow(this.contract, this.modelName, row));
		const baseFieldToColumn = getFieldToColumnMap(this.contract, this.modelName);
		const variantFieldToColumn = getFieldToColumnMap(this.contract, variant.modelName);
		const mergedFieldToColumn = {
			...baseFieldToColumn,
			...variantFieldToColumn
		};
		return data.map((row) => {
			const mapped = {};
			for (const [fieldName, value] of Object.entries(row)) {
				if (value === void 0) continue;
				const columnName = mergedFieldToColumn[fieldName] ?? fieldName;
				mapped[columnName] = value;
			}
			mapped[polyInfo.discriminatorColumn] = variant.value;
			return mapped;
		});
	}
	async createCount(data) {
		if (data.length === 0) return 0;
		this.#assertNotMtiVariant("createCount()");
		const rows = data;
		const mappedRows = this.#mapCreateRows(rows);
		applyCreateDefaults(this.ctx, this.tableName, mappedRows);
		if (this.contract.capabilities?.["sql"]?.["defaultInInsert"] !== true) {
			const plans = compileInsertCountSplit(this.contract, this.tableName, mappedRows);
			for (const plan of plans) await executeQueryPlan(this.ctx.runtime, plan).toArray();
			return data.length;
		}
		const compiled = compileInsertCount(this.contract, this.tableName, mappedRows);
		await executeQueryPlan(this.ctx.runtime, compiled).toArray();
		return data.length;
	}
	/**
	* Passing `update: {}` makes this behave like a conditional create.
	* On conflict, `ON CONFLICT DO NOTHING RETURNING ...` may return zero rows,
	* so this method may issue a follow-up reload query to return the existing row.
	*/
	async upsert(input) {
		assertReturningCapability(this.contract, "upsert()");
		this.#assertNotMtiVariant("upsert()");
		const createValues = this.#mapCreateRows([input.create])[0] ?? {};
		applyCreateDefaults(this.ctx, this.tableName, [createValues]);
		const updateValues = mapModelDataToStorageRow(this.contract, this.modelName, input.update);
		const hasUpdateValues = Object.keys(updateValues).length > 0;
		const conflictColumns = resolveUpsertConflictColumns(this.contract, this.modelName, input.conflictOn);
		if (conflictColumns.length === 0) throw new Error(`upsert() for model "${this.modelName}" requires conflict columns`);
		const parentJoinColumns = this.state.includes.map((include) => include.localColumn);
		const { selectedForQuery: selectedForUpsert, hiddenColumns } = augmentSelectionForJoinColumns(this.state.selectedFields, parentJoinColumns);
		const compiled = compileUpsertReturning(this.contract, this.tableName, createValues, updateValues, conflictColumns, selectedForUpsert);
		const row = await executeMutationReturningSingleRow({
			contract: this.contract,
			runtime: this.ctx.runtime,
			compiled,
			modelName: this.modelName,
			includes: this.state.includes,
			hiddenColumns,
			mapRow: (mapped) => mapped,
			onMissingRowMessage: `upsert() for model "${this.modelName}" did not return a row`
		});
		if (row) return row;
		if (!hasUpdateValues) {
			const conflictCriterion = this.#buildUpsertConflictCriterion(createValues, conflictColumns);
			const existing = await this.#reloadMutationRowByCriterion(conflictCriterion, "upsert conflict");
			if (existing) return existing;
		}
		throw new Error(`upsert() for model "${this.modelName}" did not return a row`);
	}
	async update(data) {
		assertReturningCapability(this.contract, "update()");
		if (hasNestedMutationCallbacks(this.contract, this.modelName, data)) {
			const updatedRow = await executeNestedUpdateMutation({
				context: this.ctx.context,
				runtime: this.ctx.runtime,
				modelName: this.modelName,
				filters: this.state.filters,
				data
			});
			if (!updatedRow) return null;
			const pkCriterion = buildPrimaryKeyFilterFromRow(this.contract, this.modelName, updatedRow);
			return this.#reloadMutationRowByPrimaryKey(pkCriterion);
		}
		return (await this.updateAll(data))[0] ?? null;
	}
	updateAll(data) {
		assertReturningCapability(this.contract, "updateAll()");
		const mappedData = mapModelDataToStorageRow(this.contract, this.modelName, data);
		if (Object.keys(mappedData).length === 0) {
			const generator = async function* () {};
			return new AsyncIterableResult(generator());
		}
		const parentJoinColumns = this.state.includes.map((include) => include.localColumn);
		const { selectedForQuery: selectedForUpdate, hiddenColumns } = augmentSelectionForJoinColumns(this.state.selectedFields, parentJoinColumns);
		const compiled = compileUpdateReturning(this.contract, this.tableName, mappedData, this.state.filters, selectedForUpdate);
		return dispatchMutationRows({
			contract: this.contract,
			runtime: this.ctx.runtime,
			compiled,
			modelName: this.modelName,
			includes: this.state.includes,
			hiddenColumns,
			mapRow: (mapped) => mapped
		});
	}
	async updateCount(data) {
		const mappedData = mapModelDataToStorageRow(this.contract, this.modelName, data);
		if (Object.keys(mappedData).length === 0) return 0;
		const primaryKeyColumn = resolvePrimaryKeyColumn(this.contract, this.tableName);
		const countState = {
			...emptyState(),
			filters: this.state.filters,
			selectedFields: [primaryKeyColumn]
		};
		const countCompiled = compileSelect(this.contract, this.tableName, countState);
		const matchingRows = await executeQueryPlan(this.ctx.runtime, countCompiled).toArray();
		const compiled = compileUpdateCount(this.contract, this.tableName, mappedData, this.state.filters);
		await executeQueryPlan(this.ctx.runtime, compiled).toArray();
		return matchingRows.length;
	}
	async delete() {
		assertReturningCapability(this.contract, "delete()");
		return (await this.deleteAll().toArray())[0] ?? null;
	}
	deleteAll() {
		assertReturningCapability(this.contract, "deleteAll()");
		const parentJoinColumns = this.state.includes.map((include) => include.localColumn);
		const { selectedForQuery: selectedForDelete, hiddenColumns } = augmentSelectionForJoinColumns(this.state.selectedFields, parentJoinColumns);
		const compiled = compileDeleteReturning(this.contract, this.tableName, this.state.filters, selectedForDelete);
		return dispatchMutationRows({
			contract: this.contract,
			runtime: this.ctx.runtime,
			compiled,
			modelName: this.modelName,
			includes: this.state.includes,
			hiddenColumns,
			mapRow: (mapped) => mapped
		});
	}
	async deleteCount() {
		const primaryKeyColumn = resolvePrimaryKeyColumn(this.contract, this.tableName);
		const countState = {
			...emptyState(),
			filters: this.state.filters,
			selectedFields: [primaryKeyColumn]
		};
		const countCompiled = compileSelect(this.contract, this.tableName, countState);
		const matchingRows = await executeQueryPlan(this.ctx.runtime, countCompiled).toArray();
		const compiled = compileDeleteCount(this.contract, this.tableName, this.state.filters);
		await executeQueryPlan(this.ctx.runtime, compiled).toArray();
		return matchingRows.length;
	}
	#buildUpsertConflictCriterion(createValues, conflictColumns) {
		const columnToField = getColumnToFieldMap(this.contract, this.modelName);
		const criterion = {};
		for (const columnName of conflictColumns) {
			if (!(columnName in createValues)) throw new Error(`upsert() for model "${this.modelName}" requires create value for conflict column "${columnName}"`);
			const fieldName = columnToField[columnName] ?? columnName;
			criterion[fieldName] = createValues[columnName];
		}
		return criterion;
	}
	async #reloadMutationRowByPrimaryKey(criterion) {
		return this.#reloadMutationRowByCriterion(criterion, "primary key");
	}
	async #reloadMutationRowByCriterion(criterion, criterionLabel) {
		const whereExpr = shorthandToWhereExpr(this.ctx.context, this.modelName, criterion);
		if (!whereExpr) throw new Error(`Failed to build ${criterionLabel} filter for mutation result on model "${this.modelName}"`);
		const resultState = {
			...emptyState(),
			filters: [whereExpr],
			includes: this.state.includes,
			selectedFields: this.state.selectedFields,
			limit: 1
		};
		return (await dispatchCollectionRows({
			contract: this.contract,
			runtime: this.ctx.runtime,
			state: resultState,
			tableName: this.tableName,
			modelName: this.modelName
		}))[0] ?? null;
	}
	#assertIncludeRefinementMode(action) {
		if (this.includeRefinementMode) return;
		throw new Error(`${action} is only available inside include() refinement callbacks`);
	}
	#clone(overrides) {
		return this.#createSelf({
			...this.state,
			...overrides
		});
	}
	#cloneWithRow(overrides) {
		return this.#createSelf({
			...this.state,
			...overrides
		});
	}
	#createSelf(state) {
		const Ctor = this.constructor;
		return new Ctor(this.ctx, this.modelName, {
			tableName: this.tableName,
			state,
			registry: this.registry,
			includeRefinementMode: this.includeRefinementMode
		});
	}
	#createCollection(modelName, options) {
		return new ((this.registry.get(modelName)) ?? Collection)(this.ctx, modelName, {
			tableName: options.tableName,
			state: options.state,
			registry: options.registry ?? this.registry,
			includeRefinementMode: options.includeRefinementMode ?? this.includeRefinementMode
		});
	}
	#dispatch() {
		return dispatchCollectionRows({
			contract: this.contract,
			runtime: this.ctx.runtime,
			state: this.state,
			tableName: this.tableName,
			modelName: this.modelName
		});
	}
};

//#endregion
//#region src/orm.ts
function orm(options) {
	const { runtime, collections, context } = options;
	const contract = context.contract;
	const ctx = {
		runtime,
		context
	};
	const modelNames = new Set(Object.keys(contract.models));
	const collectionRegistry = createCollectionRegistry(contract, collections);
	const cache = /* @__PURE__ */ new Map();
	return new Proxy({}, { get(_target, prop) {
		if (typeof prop !== "string") return;
		if (!modelNames.has(prop)) throw new Error(`No model found for '${prop}'. Available models: ${[...modelNames].join(", ")}`);
		const modelName = prop;
		const cached = cache.get(modelName);
		if (cached) return cached;
		const collection = new ((collectionRegistry.get(modelName)) ?? Collection)(ctx, modelName, { registry: collectionRegistry });
		cache.set(modelName, collection);
		return collection;
	} });
}
function createCollectionRegistry(contract, collections) {
	const registry = /* @__PURE__ */ new Map();
	if (!collections) return registry;
	const models = contract.models;
	for (const [key, collectionClass] of Object.entries(collections)) {
		if (!collectionClass) continue;
		if (!isCollectionClass(collectionClass)) throw new Error(`Custom collection '${key}' must be a Collection class (constructor), not an instance`);
		if (!Object.hasOwn(models, key)) throw new Error(`No model found for custom collection '${key}'. Available models: ${Object.keys(models).join(", ")}`);
		registry.set(key, collectionClass);
	}
	return registry;
}
function isCollectionClass(value) {
	if (typeof value !== "function") return false;
	const candidate = value;
	if (!candidate.prototype || typeof candidate.prototype !== "object") return false;
	return candidate.prototype instanceof Collection;
}

//#endregion
export { Collection, GroupedCollection, all, and, emptyState, not, or, orm };
//# sourceMappingURL=index.mjs.map