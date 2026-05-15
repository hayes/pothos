import { assertUniqueCodecOwner } from "@prisma-next/framework-components/control";
import { ifDefined } from "@prisma-next/utils/defined";

//#region src/core/assembly.ts
function hasCodecControlHooks(descriptor) {
	if (typeof descriptor !== "object" || descriptor === null) return false;
	const hooks = descriptor.types?.codecTypes?.controlPlaneHooks;
	return hooks !== null && hooks !== void 0 && typeof hooks === "object";
}
function extractCodecControlHooks(descriptors) {
	const hooks = /* @__PURE__ */ new Map();
	const owners = /* @__PURE__ */ new Map();
	for (const descriptor of descriptors) {
		if (typeof descriptor !== "object" || descriptor === null) continue;
		if (!hasCodecControlHooks(descriptor)) continue;
		const controlPlaneHooks = descriptor.types.codecTypes.controlPlaneHooks;
		for (const [codecId, hook] of Object.entries(controlPlaneHooks)) {
			assertUniqueCodecOwner({
				codecId,
				owners,
				descriptorId: descriptor.id,
				entityLabel: "control hooks",
				entityOwnershipLabel: "owner"
			});
			hooks.set(codecId, hook);
			owners.set(codecId, descriptor.id);
		}
	}
	return hooks;
}

//#endregion
//#region src/core/migrations/types.ts
function isDatabaseDependencyProvider(value) {
	return typeof value === "object" && value !== null && "databaseDependencies" in value;
}
function collectInitDependencies(components) {
	const result = [];
	for (const component of components) {
		if (!isDatabaseDependencyProvider(component)) continue;
		const deps = component.databaseDependencies?.init;
		if (!deps) continue;
		result.push(...deps);
	}
	return result;
}

//#endregion
//#region src/core/schema-verify/verify-helpers.ts
/**
* Compares two arrays of strings for equality (order-sensitive).
*/
function arraysEqual(a, b) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}
/**
* Checks if a unique constraint requirement is satisfied by the given columns.
*
* Semantic satisfaction: a unique constraint requirement can be satisfied by:
* - A unique constraint with the same columns, OR
* - A unique index with the same columns
*
* @param uniques - The unique constraints in the schema table
* @param indexes - The indexes in the schema table
* @param columns - The columns required by the unique constraint
* @returns true if the requirement is satisfied
*/
function isUniqueConstraintSatisfied(uniques, indexes, columns) {
	if (uniques.some((unique) => arraysEqual(unique.columns, columns))) return true;
	return indexes.some((index) => index.unique && arraysEqual(index.columns, columns));
}
/**
* Checks if an index requirement is satisfied by the given columns.
*
* Semantic satisfaction: a non-unique index requirement can be satisfied by:
* - Any index (unique or non-unique) with the same columns, OR
* - A unique constraint with the same columns (stronger satisfies weaker)
*
* @param indexes - The indexes in the schema table
* @param uniques - The unique constraints in the schema table
* @param columns - The columns required by the index
* @returns true if the requirement is satisfied
*/
function isIndexSatisfied(indexes, uniques, columns) {
	if (indexes.some((index) => arraysEqual(index.columns, columns))) return true;
	return uniques.some((unique) => arraysEqual(unique.columns, columns));
}
/**
* Verifies primary key matches between contract and schema.
* Returns 'pass' or 'fail'.
*
* Uses semantic satisfaction: identity is based on (table + kind + columns).
* Name differences are ignored by default (names are for DDL/diagnostics, not identity).
*/
function verifyPrimaryKey(contractPK, schemaPK, tableName, issues) {
	if (!schemaPK) {
		issues.push({
			kind: "primary_key_mismatch",
			table: tableName,
			expected: contractPK.columns.join(", "),
			message: `Table "${tableName}" is missing primary key`
		});
		return "fail";
	}
	if (!arraysEqual(contractPK.columns, schemaPK.columns)) {
		issues.push({
			kind: "primary_key_mismatch",
			table: tableName,
			expected: contractPK.columns.join(", "),
			actual: schemaPK.columns.join(", "),
			message: `Table "${tableName}" has primary key mismatch: expected columns [${contractPK.columns.join(", ")}], got [${schemaPK.columns.join(", ")}]`
		});
		return "fail";
	}
	return "pass";
}
/**
* Verifies foreign keys match between contract and schema.
* Returns verification nodes for the tree.
*
* Uses semantic satisfaction: identity is based on (table + columns + referenced table + referenced columns).
* Name differences are ignored by default (names are for DDL/diagnostics, not identity).
*/
function verifyForeignKeys(contractFKs, schemaFKs, tableName, tablePath, issues, strict) {
	const nodes = [];
	for (const contractFK of contractFKs) {
		const fkPath = `${tablePath}.foreignKeys[${contractFK.columns.join(",")}]`;
		const matchingFK = schemaFKs.find((fk) => {
			return arraysEqual(fk.columns, contractFK.columns) && fk.referencedTable === contractFK.references.table && arraysEqual(fk.referencedColumns, contractFK.references.columns);
		});
		if (!matchingFK) {
			issues.push({
				kind: "foreign_key_mismatch",
				table: tableName,
				expected: `${contractFK.columns.join(", ")} -> ${contractFK.references.table}(${contractFK.references.columns.join(", ")})`,
				message: `Table "${tableName}" is missing foreign key: ${contractFK.columns.join(", ")} -> ${contractFK.references.table}(${contractFK.references.columns.join(", ")})`
			});
			nodes.push({
				status: "fail",
				kind: "foreignKey",
				name: `foreignKey(${contractFK.columns.join(", ")})`,
				contractPath: fkPath,
				code: "foreign_key_mismatch",
				message: "Foreign key missing",
				expected: contractFK,
				actual: void 0,
				children: []
			});
		} else {
			const actionMismatches = getReferentialActionMismatches(contractFK, matchingFK);
			if (actionMismatches.length > 0) {
				const combinedMessage = actionMismatches.map((m) => m.message).join("; ");
				const combinedExpected = actionMismatches.map((m) => m.expected).join(", ");
				const combinedActual = actionMismatches.map((m) => m.actual).join(", ");
				issues.push({
					kind: "foreign_key_mismatch",
					table: tableName,
					indexOrConstraint: matchingFK.name ?? `fk(${contractFK.columns.join(",")})`,
					expected: combinedExpected,
					actual: combinedActual,
					message: `Table "${tableName}" foreign key ${contractFK.columns.join(", ")} -> ${contractFK.references.table}: ${combinedMessage}`
				});
				nodes.push({
					status: "fail",
					kind: "foreignKey",
					name: `foreignKey(${contractFK.columns.join(", ")})`,
					contractPath: fkPath,
					code: "foreign_key_mismatch",
					message: combinedMessage,
					expected: contractFK,
					actual: matchingFK,
					children: []
				});
			} else nodes.push({
				status: "pass",
				kind: "foreignKey",
				name: `foreignKey(${contractFK.columns.join(", ")})`,
				contractPath: fkPath,
				code: "",
				message: "",
				expected: void 0,
				actual: void 0,
				children: []
			});
		}
	}
	if (strict) {
		for (const schemaFK of schemaFKs) if (!contractFKs.find((fk) => {
			return arraysEqual(fk.columns, schemaFK.columns) && fk.references.table === schemaFK.referencedTable && arraysEqual(fk.references.columns, schemaFK.referencedColumns);
		})) {
			issues.push({
				kind: "extra_foreign_key",
				table: tableName,
				indexOrConstraint: schemaFK.name ?? `fk(${schemaFK.columns.join(",")})`,
				message: `Extra foreign key found in database (not in contract): ${schemaFK.columns.join(", ")} -> ${schemaFK.referencedTable}(${schemaFK.referencedColumns.join(", ")})`
			});
			nodes.push({
				status: "fail",
				kind: "foreignKey",
				name: `foreignKey(${schemaFK.columns.join(", ")})`,
				contractPath: `${tablePath}.foreignKeys[${schemaFK.columns.join(",")}]`,
				code: "extra_foreign_key",
				message: "Extra foreign key found",
				expected: void 0,
				actual: schemaFK,
				children: []
			});
		}
	}
	return nodes;
}
/**
* Verifies unique constraints match between contract and schema.
* Returns verification nodes for the tree.
*
* Uses semantic satisfaction: identity is based on (table + kind + columns).
* A unique constraint requirement can be satisfied by either:
* - A unique constraint with the same columns, or
* - A unique index with the same columns
*
* Name differences are ignored by default (names are for DDL/diagnostics, not identity).
*/
function verifyUniqueConstraints(contractUniques, schemaUniques, schemaIndexes, tableName, tablePath, issues, strict) {
	const nodes = [];
	for (const contractUnique of contractUniques) {
		const uniquePath = `${tablePath}.uniques[${contractUnique.columns.join(",")}]`;
		const matchingUnique = schemaUniques.find((u) => arraysEqual(u.columns, contractUnique.columns));
		const matchingUniqueIndex = !matchingUnique && schemaIndexes.find((idx) => idx.unique && arraysEqual(idx.columns, contractUnique.columns));
		if (!matchingUnique && !matchingUniqueIndex) {
			issues.push({
				kind: "unique_constraint_mismatch",
				table: tableName,
				expected: contractUnique.columns.join(", "),
				message: `Table "${tableName}" is missing unique constraint: ${contractUnique.columns.join(", ")}`
			});
			nodes.push({
				status: "fail",
				kind: "unique",
				name: `unique(${contractUnique.columns.join(", ")})`,
				contractPath: uniquePath,
				code: "unique_constraint_mismatch",
				message: "Unique constraint missing",
				expected: contractUnique,
				actual: void 0,
				children: []
			});
		} else nodes.push({
			status: "pass",
			kind: "unique",
			name: `unique(${contractUnique.columns.join(", ")})`,
			contractPath: uniquePath,
			code: "",
			message: "",
			expected: void 0,
			actual: void 0,
			children: []
		});
	}
	if (strict) {
		for (const schemaUnique of schemaUniques) if (!contractUniques.find((u) => arraysEqual(u.columns, schemaUnique.columns))) {
			issues.push({
				kind: "extra_unique_constraint",
				table: tableName,
				indexOrConstraint: schemaUnique.name ?? `unique(${schemaUnique.columns.join(",")})`,
				message: `Extra unique constraint found in database (not in contract): ${schemaUnique.columns.join(", ")}`
			});
			nodes.push({
				status: "fail",
				kind: "unique",
				name: `unique(${schemaUnique.columns.join(", ")})`,
				contractPath: `${tablePath}.uniques[${schemaUnique.columns.join(",")}]`,
				code: "extra_unique_constraint",
				message: "Extra unique constraint found",
				expected: void 0,
				actual: schemaUnique,
				children: []
			});
		}
	}
	return nodes;
}
/**
* Verifies indexes match between contract and schema.
* Returns verification nodes for the tree.
*
* Uses semantic satisfaction: identity is based on (table + kind + columns).
* A non-unique index requirement can be satisfied by either:
* - A non-unique index with the same columns, or
* - A unique index with the same columns (stronger satisfies weaker)
*
* Name differences are ignored by default (names are for DDL/diagnostics, not identity).
*/
function verifyIndexes(contractIndexes, schemaIndexes, schemaUniques, tableName, tablePath, issues, strict) {
	const nodes = [];
	for (const contractIndex of contractIndexes) {
		const indexPath = `${tablePath}.indexes[${contractIndex.columns.join(",")}]`;
		const matchingIndex = schemaIndexes.find((idx) => arraysEqual(idx.columns, contractIndex.columns));
		const matchingUniqueConstraint = !matchingIndex && schemaUniques.find((u) => arraysEqual(u.columns, contractIndex.columns));
		if (!matchingIndex && !matchingUniqueConstraint) {
			issues.push({
				kind: "index_mismatch",
				table: tableName,
				expected: contractIndex.columns.join(", "),
				message: `Table "${tableName}" is missing index: ${contractIndex.columns.join(", ")}`
			});
			nodes.push({
				status: "fail",
				kind: "index",
				name: `index(${contractIndex.columns.join(", ")})`,
				contractPath: indexPath,
				code: "index_mismatch",
				message: "Index missing",
				expected: contractIndex,
				actual: void 0,
				children: []
			});
		} else nodes.push({
			status: "pass",
			kind: "index",
			name: `index(${contractIndex.columns.join(", ")})`,
			contractPath: indexPath,
			code: "",
			message: "",
			expected: void 0,
			actual: void 0,
			children: []
		});
	}
	if (strict) for (const schemaIndex of schemaIndexes) {
		if (schemaIndex.unique) continue;
		if (!contractIndexes.find((idx) => arraysEqual(idx.columns, schemaIndex.columns))) {
			issues.push({
				kind: "extra_index",
				table: tableName,
				indexOrConstraint: schemaIndex.name ?? `idx(${schemaIndex.columns.join(",")})`,
				message: `Extra index found in database (not in contract): ${schemaIndex.columns.join(", ")}`
			});
			nodes.push({
				status: "fail",
				kind: "index",
				name: `index(${schemaIndex.columns.join(", ")})`,
				contractPath: `${tablePath}.indexes[${schemaIndex.columns.join(",")}]`,
				code: "extra_index",
				message: "Extra index found",
				expected: void 0,
				actual: schemaIndex,
				children: []
			});
		}
	}
	return nodes;
}
/**
* Verifies database dependencies are installed using component-owned verification hooks.
* Checks whether each dependency is satisfied by verifying its id is present in
* schema.dependencies (populated from introspection).
*
* Returns verification nodes for the tree.
*/
function verifyDatabaseDependencies(dependencies, schema, issues) {
	const nodes = [];
	const installedIds = new Set(schema.dependencies.map((d) => d.id));
	for (const dependency of dependencies) {
		const isSatisfied = installedIds.has(dependency.id);
		const depPath = `dependencies.${dependency.id}`;
		if (!isSatisfied) {
			const depIssue = {
				kind: "dependency_missing",
				dependencyId: dependency.id,
				message: `Dependency "${dependency.id}" is missing from database`
			};
			issues.push(depIssue);
			const nodeMessage = depIssue.message;
			nodes.push({
				status: "fail",
				kind: "databaseDependency",
				name: dependency.label,
				contractPath: depPath,
				code: "dependency_missing",
				message: nodeMessage,
				expected: void 0,
				actual: void 0,
				children: []
			});
		} else nodes.push({
			status: "pass",
			kind: "databaseDependency",
			name: dependency.label,
			contractPath: depPath,
			code: "",
			message: "",
			expected: void 0,
			actual: void 0,
			children: []
		});
	}
	return nodes;
}
/**
* Computes counts of pass/warn/fail nodes by traversing the tree.
*/
function computeCounts(node) {
	let pass = 0;
	let warn = 0;
	let fail = 0;
	function traverse(n) {
		if (n.status === "pass") pass++;
		else if (n.status === "warn") warn++;
		else if (n.status === "fail") fail++;
		if (n.children) for (const child of n.children) traverse(child);
	}
	traverse(node);
	return {
		pass,
		warn,
		fail,
		totalNodes: pass + warn + fail
	};
}
/**
* Compares referential actions between a contract FK and a schema FK.
* Only compares when the contract FK explicitly specifies onDelete or onUpdate.
* Returns all mismatches (both onDelete and onUpdate) so both are reported at once.
*
* Note: 'noAction' in the contract is semantically equivalent to undefined in the
* schema IR, because the introspection adapter omits 'NO ACTION' (the database default)
* to keep the IR sparse. We normalize both sides before comparing.
*/
function getReferentialActionMismatches(contractFK, schemaFK) {
	const mismatches = [];
	const contractOnDelete = normalizeReferentialAction(contractFK.onDelete);
	const schemaOnDelete = normalizeReferentialAction(schemaFK.onDelete);
	if (contractOnDelete !== void 0 && contractOnDelete !== schemaOnDelete) mismatches.push({
		expected: `onDelete: ${contractFK.onDelete}`,
		actual: `onDelete: ${schemaFK.onDelete ?? "noAction (default)"}`,
		message: `onDelete mismatch: expected ${contractFK.onDelete}, got ${schemaFK.onDelete ?? "noAction (default)"}`
	});
	const contractOnUpdate = normalizeReferentialAction(contractFK.onUpdate);
	const schemaOnUpdate = normalizeReferentialAction(schemaFK.onUpdate);
	if (contractOnUpdate !== void 0 && contractOnUpdate !== schemaOnUpdate) mismatches.push({
		expected: `onUpdate: ${contractFK.onUpdate}`,
		actual: `onUpdate: ${schemaFK.onUpdate ?? "noAction (default)"}`,
		message: `onUpdate mismatch: expected ${contractFK.onUpdate}, got ${schemaFK.onUpdate ?? "noAction (default)"}`
	});
	return mismatches;
}
/**
* Normalizes a referential action value for comparison.
* 'noAction' is the database default and equivalent to undefined (omitted) in the sparse IR.
*/
function normalizeReferentialAction(action) {
	return action === "noAction" ? void 0 : action;
}

//#endregion
//#region src/core/schema-verify/verify-sql-schema.ts
/**
* Verifies that a SqlSchemaIR matches a Contract.
*
* This is a pure function that does NOT perform any database I/O.
* It takes an already-introspected schema IR and compares it against
* the contract requirements.
*
* @param options - Verification options
* @returns VerifyDatabaseSchemaResult with verification tree and issues
*/
function verifySqlSchema(options) {
	const { contract, schema, strict, context, typeMetadataRegistry, normalizeDefault, normalizeNativeType } = options;
	const startTime = Date.now();
	const codecHooks = extractCodecControlHooks(options.frameworkComponents);
	const { contractStorageHash, contractProfileHash, contractTarget } = extractContractMetadata(contract);
	const storageTypes = contract.storage.types ?? {};
	const { issues, rootChildren } = verifySchemaTables({
		contract,
		schema,
		strict,
		typeMetadataRegistry,
		codecHooks,
		storageTypes,
		...ifDefined("normalizeDefault", normalizeDefault),
		...ifDefined("normalizeNativeType", normalizeNativeType)
	});
	validateFrameworkComponentsForExtensions(contract, options.frameworkComponents);
	const storageTypeEntries = Object.entries(storageTypes);
	if (storageTypeEntries.length > 0) {
		const typeNodes = [];
		for (const [typeName, typeInstance] of storageTypeEntries) {
			const hook = codecHooks.get(typeInstance.codecId);
			const typeIssues = hook?.verifyType ? hook.verifyType({
				typeName,
				typeInstance,
				schema
			}) : [];
			if (typeIssues.length > 0) issues.push(...typeIssues);
			const typeStatus = typeIssues.length > 0 ? "fail" : "pass";
			const typeCode = typeIssues.length > 0 ? typeIssues[0]?.kind ?? "" : "";
			typeNodes.push({
				status: typeStatus,
				kind: "storageType",
				name: `type ${typeName}`,
				contractPath: `storage.types.${typeName}`,
				code: typeCode,
				message: typeIssues.length > 0 ? `${typeIssues.length} issue${typeIssues.length === 1 ? "" : "s"}` : "",
				expected: void 0,
				actual: void 0,
				children: []
			});
		}
		const typesStatus = typeNodes.some((n) => n.status === "fail") ? "fail" : "pass";
		rootChildren.push({
			status: typesStatus,
			kind: "storageTypes",
			name: "types",
			contractPath: "storage.types",
			code: typesStatus === "fail" ? "type_mismatch" : "",
			message: "",
			expected: void 0,
			actual: void 0,
			children: typeNodes
		});
	}
	const dependencyStatuses = verifyDatabaseDependencies(collectInitDependencies(options.frameworkComponents), schema, issues);
	rootChildren.push(...dependencyStatuses);
	const root = buildRootNode(rootChildren);
	const counts = computeCounts(root);
	const ok = counts.fail === 0;
	const code = ok ? void 0 : "PN-SCHEMA-0001";
	const summary = ok ? "Database schema satisfies contract" : `Database schema does not satisfy contract (${counts.fail} failure${counts.fail === 1 ? "" : "s"})`;
	const totalTime = Date.now() - startTime;
	return {
		ok,
		...ifDefined("code", code),
		summary,
		contract: {
			storageHash: contractStorageHash,
			...ifDefined("profileHash", contractProfileHash)
		},
		target: {
			expected: contractTarget,
			actual: contractTarget
		},
		schema: {
			issues,
			root,
			counts
		},
		meta: {
			strict,
			...ifDefined("contractPath", context?.contractPath),
			...ifDefined("configPath", context?.configPath)
		},
		timings: { total: totalTime }
	};
}
function extractContractMetadata(contract) {
	return {
		contractStorageHash: contract.storage.storageHash,
		contractProfileHash: "profileHash" in contract && typeof contract.profileHash === "string" ? contract.profileHash : void 0,
		contractTarget: contract.target
	};
}
function verifySchemaTables(options) {
	const { contract, schema, strict, typeMetadataRegistry, codecHooks, storageTypes, normalizeDefault, normalizeNativeType } = options;
	const issues = [];
	const rootChildren = [];
	const contractTables = contract.storage.tables;
	const schemaTables = schema.tables;
	for (const [tableName, contractTable] of Object.entries(contractTables)) {
		const schemaTable = schemaTables[tableName];
		const tablePath = `storage.tables.${tableName}`;
		if (!schemaTable) {
			issues.push({
				kind: "missing_table",
				table: tableName,
				message: `Table "${tableName}" is missing from database`
			});
			rootChildren.push({
				status: "fail",
				kind: "table",
				name: `table ${tableName}`,
				contractPath: tablePath,
				code: "missing_table",
				message: `Table "${tableName}" is missing`,
				expected: void 0,
				actual: void 0,
				children: []
			});
			continue;
		}
		const tableChildren = verifyTableChildren({
			contractTable,
			schemaTable,
			tableName,
			tablePath,
			issues,
			strict,
			typeMetadataRegistry,
			codecHooks,
			storageTypes,
			...ifDefined("normalizeDefault", normalizeDefault),
			...ifDefined("normalizeNativeType", normalizeNativeType)
		});
		rootChildren.push(buildTableNode(tableName, tablePath, tableChildren));
	}
	if (strict) {
		for (const tableName of Object.keys(schemaTables)) if (!contractTables[tableName]) {
			issues.push({
				kind: "extra_table",
				table: tableName,
				message: `Extra table "${tableName}" found in database (not in contract)`
			});
			rootChildren.push({
				status: "fail",
				kind: "table",
				name: `table ${tableName}`,
				contractPath: `storage.tables.${tableName}`,
				code: "extra_table",
				message: `Extra table "${tableName}" found`,
				expected: void 0,
				actual: void 0,
				children: []
			});
		}
	}
	return {
		issues,
		rootChildren
	};
}
function verifyTableChildren(options) {
	const { contractTable, schemaTable, tableName, tablePath, issues, strict, typeMetadataRegistry, codecHooks, storageTypes, normalizeDefault, normalizeNativeType } = options;
	const tableChildren = [];
	const columnNodes = collectContractColumnNodes({
		contractTable,
		schemaTable,
		tableName,
		tablePath,
		issues,
		strict,
		typeMetadataRegistry,
		codecHooks,
		storageTypes,
		...ifDefined("normalizeDefault", normalizeDefault),
		...ifDefined("normalizeNativeType", normalizeNativeType)
	});
	if (columnNodes.length > 0) tableChildren.push(buildColumnsNode(tablePath, columnNodes));
	if (strict) appendExtraColumnNodes({
		contractTable,
		schemaTable,
		tableName,
		tablePath,
		issues,
		columnNodes
	});
	if (contractTable.primaryKey) if (verifyPrimaryKey(contractTable.primaryKey, schemaTable.primaryKey, tableName, issues) === "fail") tableChildren.push({
		status: "fail",
		kind: "primaryKey",
		name: `primary key: ${contractTable.primaryKey.columns.join(", ")}`,
		contractPath: `${tablePath}.primaryKey`,
		code: "primary_key_mismatch",
		message: "Primary key mismatch",
		expected: contractTable.primaryKey,
		actual: schemaTable.primaryKey,
		children: []
	});
	else tableChildren.push({
		status: "pass",
		kind: "primaryKey",
		name: `primary key: ${contractTable.primaryKey.columns.join(", ")}`,
		contractPath: `${tablePath}.primaryKey`,
		code: "",
		message: "",
		expected: void 0,
		actual: void 0,
		children: []
	});
	else if (schemaTable.primaryKey && strict) {
		issues.push({
			kind: "extra_primary_key",
			table: tableName,
			message: "Extra primary key found in database (not in contract)"
		});
		tableChildren.push({
			status: "fail",
			kind: "primaryKey",
			name: `primary key: ${schemaTable.primaryKey.columns.join(", ")}`,
			contractPath: `${tablePath}.primaryKey`,
			code: "extra_primary_key",
			message: "Extra primary key found",
			expected: void 0,
			actual: schemaTable.primaryKey,
			children: []
		});
	}
	const constraintFks = contractTable.foreignKeys.filter((fk) => fk.constraint === true);
	if (constraintFks.length > 0 || strict) {
		const fkStatuses = verifyForeignKeys(constraintFks, schemaTable.foreignKeys, tableName, tablePath, issues, strict);
		tableChildren.push(...fkStatuses);
	}
	const uniqueStatuses = verifyUniqueConstraints(contractTable.uniques, schemaTable.uniques, schemaTable.indexes, tableName, tablePath, issues, strict);
	tableChildren.push(...uniqueStatuses);
	const fkBackingIndexes = contractTable.foreignKeys.filter((fk) => fk.index === true && !contractTable.indexes.some((idx) => arraysEqual(idx.columns, fk.columns))).map((fk) => ({ columns: fk.columns }));
	const indexStatuses = verifyIndexes([...contractTable.indexes, ...fkBackingIndexes], schemaTable.indexes, schemaTable.uniques, tableName, tablePath, issues, strict);
	tableChildren.push(...indexStatuses);
	return tableChildren;
}
function collectContractColumnNodes(options) {
	const { contractTable, schemaTable, tableName, tablePath, issues, strict, typeMetadataRegistry, codecHooks, storageTypes, normalizeDefault, normalizeNativeType } = options;
	const columnNodes = [];
	for (const [columnName, contractColumn] of Object.entries(contractTable.columns)) {
		const schemaColumn = schemaTable.columns[columnName];
		const columnPath = `${tablePath}.columns.${columnName}`;
		if (!schemaColumn) {
			issues.push({
				kind: "missing_column",
				table: tableName,
				column: columnName,
				message: `Column "${tableName}"."${columnName}" is missing from database`
			});
			columnNodes.push({
				status: "fail",
				kind: "column",
				name: `${columnName}: missing`,
				contractPath: columnPath,
				code: "missing_column",
				message: `Column "${columnName}" is missing`,
				expected: void 0,
				actual: void 0,
				children: []
			});
			continue;
		}
		columnNodes.push(verifyColumn({
			tableName,
			columnName,
			contractColumn,
			schemaColumn,
			columnPath,
			issues,
			strict,
			typeMetadataRegistry,
			codecHooks,
			storageTypes,
			...ifDefined("normalizeDefault", normalizeDefault),
			...ifDefined("normalizeNativeType", normalizeNativeType)
		}));
	}
	return columnNodes;
}
function appendExtraColumnNodes(options) {
	const { contractTable, schemaTable, tableName, tablePath, issues, columnNodes } = options;
	for (const [columnName, { nativeType }] of Object.entries(schemaTable.columns)) if (!contractTable.columns[columnName]) {
		issues.push({
			kind: "extra_column",
			table: tableName,
			column: columnName,
			message: `Extra column "${tableName}"."${columnName}" found in database (not in contract)`
		});
		columnNodes.push({
			status: "fail",
			kind: "column",
			name: `${columnName}: extra`,
			contractPath: `${tablePath}.columns.${columnName}`,
			code: "extra_column",
			message: `Extra column "${columnName}" found`,
			expected: void 0,
			actual: nativeType,
			children: []
		});
	}
}
function verifyColumn(options) {
	const { tableName, columnName, contractColumn, schemaColumn, columnPath, issues, strict, codecHooks, storageTypes, normalizeDefault, normalizeNativeType } = options;
	const columnChildren = [];
	let columnStatus = "pass";
	const resolvedContractColumn = resolveContractColumnTypeMetadata(contractColumn, storageTypes, {
		tableName,
		columnName
	});
	const contractNativeType = renderExpectedNativeType(contractColumn, storageTypes, codecHooks, {
		tableName,
		columnName
	});
	const schemaNativeType = normalizeNativeType?.(schemaColumn.nativeType) ?? schemaColumn.nativeType;
	if (contractNativeType !== schemaNativeType) {
		issues.push({
			kind: "type_mismatch",
			table: tableName,
			column: columnName,
			expected: contractNativeType,
			actual: schemaNativeType,
			message: `Column "${tableName}"."${columnName}" has type mismatch: expected "${contractNativeType}", got "${schemaNativeType}"`
		});
		columnChildren.push({
			status: "fail",
			kind: "type",
			name: "type",
			contractPath: `${columnPath}.nativeType`,
			code: "type_mismatch",
			message: `Type mismatch: expected ${contractNativeType}, got ${schemaNativeType}`,
			expected: contractNativeType,
			actual: schemaNativeType,
			children: []
		});
		columnStatus = "fail";
	}
	if (resolvedContractColumn.codecId) {
		const typeMetadata = options.typeMetadataRegistry.get(resolvedContractColumn.codecId);
		if (!typeMetadata) columnChildren.push({
			status: "warn",
			kind: "type",
			name: "type_metadata_missing",
			contractPath: `${columnPath}.codecId`,
			code: "type_metadata_missing",
			message: `codecId "${resolvedContractColumn.codecId}" not found in type metadata registry`,
			expected: resolvedContractColumn.codecId,
			actual: void 0,
			children: []
		});
		else if (typeMetadata.nativeType && typeMetadata.nativeType !== resolvedContractColumn.nativeType) columnChildren.push({
			status: "warn",
			kind: "type",
			name: "type_consistency",
			contractPath: `${columnPath}.codecId`,
			code: "type_consistency_warning",
			message: `codecId "${resolvedContractColumn.codecId}" maps to nativeType "${typeMetadata.nativeType}" in registry, but contract has "${resolvedContractColumn.nativeType}"`,
			expected: typeMetadata.nativeType,
			actual: resolvedContractColumn.nativeType,
			children: []
		});
	}
	if (contractColumn.nullable !== schemaColumn.nullable) {
		issues.push({
			kind: "nullability_mismatch",
			table: tableName,
			column: columnName,
			expected: String(contractColumn.nullable),
			actual: String(schemaColumn.nullable),
			message: `Column "${tableName}"."${columnName}" has nullability mismatch: expected ${contractColumn.nullable ? "nullable" : "not null"}, got ${schemaColumn.nullable ? "nullable" : "not null"}`
		});
		columnChildren.push({
			status: "fail",
			kind: "nullability",
			name: "nullability",
			contractPath: `${columnPath}.nullable`,
			code: "nullability_mismatch",
			message: `Nullability mismatch: expected ${contractColumn.nullable ? "nullable" : "not null"}, got ${schemaColumn.nullable ? "nullable" : "not null"}`,
			expected: contractColumn.nullable,
			actual: schemaColumn.nullable,
			children: []
		});
		columnStatus = "fail";
	}
	if (contractColumn.default) {
		if (!schemaColumn.default) {
			const defaultDescription = describeColumnDefault(contractColumn.default);
			issues.push({
				kind: "default_missing",
				table: tableName,
				column: columnName,
				expected: defaultDescription,
				message: `Column "${tableName}"."${columnName}" should have default ${defaultDescription} but database has no default`
			});
			columnChildren.push({
				status: "fail",
				kind: "default",
				name: "default",
				contractPath: `${columnPath}.default`,
				code: "default_missing",
				message: `Default missing: expected ${defaultDescription}`,
				expected: defaultDescription,
				actual: void 0,
				children: []
			});
			columnStatus = "fail";
		} else if (!columnDefaultsEqual(contractColumn.default, schemaColumn.default, normalizeDefault, schemaNativeType)) {
			const expectedDescription = describeColumnDefault(contractColumn.default);
			const actualDescription = schemaColumn.default;
			issues.push({
				kind: "default_mismatch",
				table: tableName,
				column: columnName,
				expected: expectedDescription,
				actual: actualDescription,
				message: `Column "${tableName}"."${columnName}" has default mismatch: expected ${expectedDescription}, got ${actualDescription}`
			});
			columnChildren.push({
				status: "fail",
				kind: "default",
				name: "default",
				contractPath: `${columnPath}.default`,
				code: "default_mismatch",
				message: `Default mismatch: expected ${expectedDescription}, got ${actualDescription}`,
				expected: expectedDescription,
				actual: actualDescription,
				children: []
			});
			columnStatus = "fail";
		}
	} else if (strict && schemaColumn.default) {
		issues.push({
			kind: "extra_default",
			table: tableName,
			column: columnName,
			actual: schemaColumn.default,
			message: `Column "${tableName}"."${columnName}" has default ${schemaColumn.default} in database but contract specifies no default`
		});
		columnChildren.push({
			status: "fail",
			kind: "default",
			name: "default",
			contractPath: `${columnPath}.default`,
			code: "extra_default",
			message: `Extra default: ${schemaColumn.default}`,
			expected: void 0,
			actual: schemaColumn.default,
			children: []
		});
		columnStatus = "fail";
	}
	const aggregated = aggregateChildState(columnChildren, columnStatus);
	const nullableText = contractColumn.nullable ? "nullable" : "not nullable";
	const columnTypeDisplay = resolvedContractColumn.codecId ? `${contractNativeType} (${resolvedContractColumn.codecId})` : contractNativeType;
	const columnMessage = aggregated.failureMessages.join("; ");
	return {
		status: aggregated.status,
		kind: "column",
		name: `${columnName}: ${columnTypeDisplay} (${nullableText})`,
		contractPath: columnPath,
		code: aggregated.firstCode,
		message: columnMessage,
		expected: void 0,
		actual: void 0,
		children: columnChildren
	};
}
function buildColumnsNode(tablePath, columnNodes) {
	return {
		status: aggregateChildState(columnNodes, "pass").status,
		kind: "columns",
		name: "columns",
		contractPath: `${tablePath}.columns`,
		code: "",
		message: "",
		expected: void 0,
		actual: void 0,
		children: columnNodes
	};
}
function buildTableNode(tableName, tablePath, tableChildren) {
	const tableStatus = aggregateChildState(tableChildren, "pass").status;
	const tableFailureMessages = tableChildren.filter((child) => child.status === "fail" && child.message).map((child) => child.message).filter((msg) => typeof msg === "string" && msg.length > 0);
	const tableMessage = tableStatus === "fail" && tableFailureMessages.length > 0 ? `${tableFailureMessages.length} issue${tableFailureMessages.length === 1 ? "" : "s"}` : "";
	const tableCode = tableStatus === "fail" && tableChildren.length > 0 && tableChildren[0] ? tableChildren[0].code : "";
	return {
		status: tableStatus,
		kind: "table",
		name: `table ${tableName}`,
		contractPath: tablePath,
		code: tableCode,
		message: tableMessage,
		expected: void 0,
		actual: void 0,
		children: tableChildren
	};
}
function buildRootNode(rootChildren) {
	return {
		status: aggregateChildState(rootChildren, "pass").status,
		kind: "contract",
		name: "contract",
		contractPath: "",
		code: "",
		message: "",
		expected: void 0,
		actual: void 0,
		children: rootChildren
	};
}
/**
* Aggregates status, failure messages, and code from children in a single pass.
* This is more efficient than calling separate functions that each iterate the array.
*/
function aggregateChildState(children, fallback) {
	let status = fallback;
	const failureMessages = [];
	let firstCode = "";
	for (const child of children) if (child.status === "fail") {
		status = "fail";
		if (!firstCode) firstCode = child.code;
		if (child.message && typeof child.message === "string" && child.message.length > 0) failureMessages.push(child.message);
	} else if (child.status === "warn" && status !== "fail") {
		status = "warn";
		if (!firstCode) firstCode = child.code;
	}
	return {
		status,
		failureMessages,
		firstCode
	};
}
function validateFrameworkComponentsForExtensions(contract, frameworkComponents) {
	const contractExtensionPacks = contract.extensionPacks ?? {};
	for (const extensionNamespace of Object.keys(contractExtensionPacks)) if (!frameworkComponents.some((component) => component.id === extensionNamespace && (component.kind === "extension" || component.kind === "adapter" || component.kind === "target"))) throw new Error(`Extension pack '${extensionNamespace}' is declared in the contract but not found in framework components. This indicates a configuration mismatch - the contract was emitted with this extension pack, but it is not provided in the current configuration.`);
}
/**
* Renders the expected native type for a contract column, expanding parameterized types
* using codec control hooks when available.
*
* This function delegates to the `expandNativeType` hook if the codec provides one,
* ensuring that the SQL family layer remains dialect-agnostic while allowing
* target-specific adapters (like Postgres) to provide their own expansion logic.
*/
function renderExpectedNativeType(contractColumn, storageTypes, codecHooks, context) {
	const { codecId, nativeType, typeParams } = resolveContractColumnTypeMetadata(contractColumn, storageTypes, context);
	if (!typeParams || !codecId) return nativeType;
	const hooks = codecHooks.get(codecId);
	if (hooks?.expandNativeType) return hooks.expandNativeType({
		nativeType,
		codecId,
		typeParams
	});
	return nativeType;
}
function resolveContractColumnTypeMetadata(contractColumn, storageTypes, context) {
	if (!contractColumn.typeRef) return contractColumn;
	const referencedType = storageTypes[contractColumn.typeRef];
	if (!referencedType) {
		const columnLabel = context ? `Column "${context.tableName}"."${context.columnName}"` : "Column";
		throw new Error(`${columnLabel} references storage type "${contractColumn.typeRef}" but it is not defined in storage.types.`);
	}
	return {
		codecId: referencedType.codecId,
		nativeType: referencedType.nativeType,
		typeParams: referencedType.typeParams
	};
}
/**
* Describes a column default for display purposes.
*/
function describeColumnDefault(columnDefault) {
	switch (columnDefault.kind) {
		case "literal": return `literal(${formatLiteralValue(columnDefault.value)})`;
		case "function": return columnDefault.expression;
	}
}
/**
* Compares a contract ColumnDefault against a schema raw default string for semantic equality.
*
* When a normalizer is provided, the raw schema default is first normalized to a ColumnDefault
* before comparison. Without a normalizer, falls back to direct string comparison against
* the contract expression.
*
* @param contractDefault - The expected default from the contract (normalized ColumnDefault)
* @param schemaDefault - The raw default expression from the database (string)
* @param normalizer - Optional target-specific normalizer to convert raw defaults
* @param nativeType - The column's native type, passed to normalizer for context
*/
function columnDefaultsEqual(contractDefault, schemaDefault, normalizer, nativeType) {
	if (!normalizer) {
		if (contractDefault.kind === "function") return contractDefault.expression === schemaDefault;
		const normalizedValue = normalizeLiteralValue(contractDefault.value, nativeType);
		if (typeof normalizedValue === "string") return normalizedValue === schemaDefault || `'${normalizedValue}'` === schemaDefault;
		return String(normalizedValue) === schemaDefault;
	}
	const normalizedSchema = normalizer(schemaDefault, nativeType ?? "");
	if (!normalizedSchema) return false;
	if (contractDefault.kind !== normalizedSchema.kind) return false;
	if (contractDefault.kind === "literal" && normalizedSchema.kind === "literal") return literalValuesEqual(normalizeLiteralValue(contractDefault.value, nativeType), normalizeLiteralValue(normalizedSchema.value, nativeType));
	if (contractDefault.kind === "function" && normalizedSchema.kind === "function") {
		const normalizeExpr = (expr) => expr.toLowerCase().replace(/\s+/g, "");
		return normalizeExpr(contractDefault.expression) === normalizeExpr(normalizedSchema.expression);
	}
	return false;
}
function isTemporalNativeType(nativeType) {
	if (!nativeType) return false;
	const normalized = nativeType.toLowerCase();
	return normalized.includes("timestamp") || normalized === "date";
}
function normalizeLiteralValue(value, nativeType) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string" && isTemporalNativeType(nativeType)) {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
	}
	return value;
}
/**
* Recursively sorts object keys for deterministic JSON comparison.
* Postgres jsonb may canonicalize key order, so two semantically equal
* objects can have different key insertion order.
*/
function stableStringify(value) {
	return JSON.stringify(value, (_key, val) => {
		if (val !== null && typeof val === "object" && !Array.isArray(val)) {
			const sorted = {};
			for (const k of Object.keys(val).sort()) sorted[k] = val[k];
			return sorted;
		}
		return val;
	});
}
function literalValuesEqual(a, b) {
	if (a === b) return true;
	if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) return stableStringify(a) === stableStringify(b);
	if (typeof a === "object" && a !== null && typeof b === "string") try {
		return stableStringify(a) === stableStringify(JSON.parse(b));
	} catch {
		return false;
	}
	if (typeof a === "string" && typeof b === "object" && b !== null) try {
		return stableStringify(JSON.parse(a)) === stableStringify(b);
	} catch {
		return false;
	}
	return false;
}
function formatLiteralValue(value) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

//#endregion
export { verifyDatabaseDependencies as a, extractCodecControlHooks as c, isUniqueConstraintSatisfied as i, arraysEqual as n, collectInitDependencies as o, isIndexSatisfied as r, isDatabaseDependencyProvider as s, verifySqlSchema as t };
//# sourceMappingURL=verify-sql-schema-Ovz7RXR5.mjs.map