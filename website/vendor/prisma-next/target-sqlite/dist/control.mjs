import { t as sqliteTargetDescriptorMeta } from "./descriptor-meta-CzGTszoH.mjs";
import { t as parseSqliteDefault } from "./default-normalizer-R-sQXAYt.mjs";
import { t as normalizeSqliteNativeType } from "./native-type-normalizer-BMovohPm.mjs";
import { d as renderDefaultLiteral } from "./tables-sKIg_lWE.mjs";
import { n as createSqliteMigrationPlanner } from "./planner-CuchCrpN.mjs";
import { a as buildWriteMarkerStatements, c as readMarkerStatement, i as buildLedgerInsertStatement, o as ensureLedgerTableStatement, s as ensureMarkerTableStatement } from "./statement-builders-B3OGOp7n.mjs";
import { contractToSchemaIR, runnerFailure, runnerSuccess } from "@prisma-next/family-sql/control";
import { verifySqlSchema } from "@prisma-next/family-sql/schema-verify";
import { ok, okVoid } from "@prisma-next/utils/result";
import { ifDefined } from "@prisma-next/utils/defined";
import { parseContractMarkerRow } from "@prisma-next/family-sql/verify";

//#region src/core/migrations/runner.ts
function createSqliteMigrationRunner(family) {
	return new SqliteMigrationRunner(family);
}
var SqliteMigrationRunner = class {
	constructor(family) {
		this.family = family;
	}
	async execute(options) {
		const driver = options.driver;
		const destinationCheck = this.ensurePlanMatchesDestinationContract(options.plan.destination, options.destinationContract);
		if (!destinationCheck.ok) return destinationCheck;
		const policyCheck = this.enforcePolicyCompatibility(options.policy, options.plan.operations);
		if (!policyCheck.ok) return policyCheck;
		const fkWasEnabled = await this.readForeignKeysEnabled(driver);
		if (fkWasEnabled) await driver.query("PRAGMA foreign_keys = OFF");
		try {
			await this.beginExclusiveTransaction(driver);
			let committed = false;
			try {
				await this.ensureControlTables(driver);
				const existingMarker = await this.readMarker(driver);
				const markerCheck = this.ensureMarkerCompatibility(existingMarker, options.plan);
				if (!markerCheck.ok) return markerCheck;
				const markerAtDestination = this.markerMatchesDestination(existingMarker, options.plan);
				const isSelfEdge = options.plan.origin?.storageHash === options.plan.destination.storageHash;
				const skipOperations = markerAtDestination && options.plan.origin != null && !isSelfEdge;
				let operationsExecuted;
				let executedOperations;
				if (skipOperations) {
					operationsExecuted = 0;
					executedOperations = [];
				} else {
					const applyResult = await this.applyPlan(driver, options);
					if (!applyResult.ok) return applyResult;
					operationsExecuted = applyResult.value.operationsExecuted;
					executedOperations = applyResult.value.executedOperations;
				}
				const schemaIR = await this.family.introspect({
					driver,
					contract: options.destinationContract
				});
				const schemaVerifyResult = verifySqlSchema({
					contract: options.destinationContract,
					schema: schemaIR,
					strict: options.strictVerification ?? true,
					context: options.context ?? {},
					typeMetadataRegistry: this.family.typeMetadataRegistry,
					frameworkComponents: options.frameworkComponents,
					normalizeDefault: parseSqliteDefault,
					normalizeNativeType: normalizeSqliteNativeType
				});
				if (!schemaVerifyResult.ok) return runnerFailure("SCHEMA_VERIFY_FAILED", schemaVerifyResult.summary, {
					why: "The resulting database schema does not satisfy the destination contract.",
					meta: { issues: schemaVerifyResult.schema.issues }
				});
				const incomingInvariants = options.plan.providedInvariants;
				const existingInvariants = new Set(existingMarker?.invariants ?? []);
				const incomingIsSubsetOfExisting = incomingInvariants.every((id) => existingInvariants.has(id));
				if (!(isSelfEdge && operationsExecuted === 0 && incomingIsSubsetOfExisting)) {
					await this.upsertMarker(driver, options, existingMarker);
					await this.recordLedgerEntry(driver, options, existingMarker, executedOperations);
				}
				if (fkWasEnabled) {
					const fkIntegrityCheck = await this.verifyForeignKeyIntegrity(driver);
					if (!fkIntegrityCheck.ok) return fkIntegrityCheck;
				}
				await this.commitTransaction(driver);
				committed = true;
				return runnerSuccess({
					operationsPlanned: options.plan.operations.length,
					operationsExecuted
				});
			} finally {
				if (!committed) await this.rollbackTransaction(driver);
			}
		} finally {
			if (fkWasEnabled) await driver.query("PRAGMA foreign_keys = ON");
		}
	}
	async readForeignKeysEnabled(driver) {
		return (await driver.query("PRAGMA foreign_keys")).rows[0]?.foreign_keys === 1;
	}
	async verifyForeignKeyIntegrity(driver) {
		const result = await driver.query("PRAGMA foreign_key_check");
		if (result.rows.length === 0) return okVoid();
		return runnerFailure("FOREIGN_KEY_VIOLATION", `Foreign key integrity check failed after migration: ${result.rows.length} violation(s).`, {
			why: "PRAGMA foreign_key_check reported violations after applying recreate-table operations.",
			meta: { violations: result.rows }
		});
	}
	async applyPlan(driver, options) {
		const checks = options.executionChecks;
		const runPrechecks = checks?.prechecks !== false;
		const runPostchecks = checks?.postchecks !== false;
		const runIdempotency = checks?.idempotencyChecks !== false;
		let operationsExecuted = 0;
		const executedOperations = [];
		for (const operation of options.plan.operations) {
			options.callbacks?.onOperationStart?.(operation);
			try {
				if (runPostchecks && runIdempotency) {
					if (await this.expectationsAreSatisfied(driver, operation.postcheck)) {
						executedOperations.push(this.createSkipRecord(operation));
						continue;
					}
				}
				if (runPrechecks) {
					const precheckResult = await this.runExpectationSteps(driver, operation.precheck, operation, "precheck");
					if (!precheckResult.ok) return precheckResult;
				}
				const executeResult = await this.runExecuteSteps(driver, operation.execute, operation);
				if (!executeResult.ok) return executeResult;
				if (runPostchecks) {
					const postcheckResult = await this.runExpectationSteps(driver, operation.postcheck, operation, "postcheck");
					if (!postcheckResult.ok) return postcheckResult;
				}
				executedOperations.push(operation);
				operationsExecuted += 1;
			} finally {
				options.callbacks?.onOperationComplete?.(operation);
			}
		}
		return ok({
			operationsExecuted,
			executedOperations
		});
	}
	async ensureControlTables(driver) {
		await this.executeStatement(driver, ensureMarkerTableStatement);
		await this.executeStatement(driver, ensureLedgerTableStatement);
	}
	async readMarker(driver) {
		const stmt = readMarkerStatement();
		try {
			const row = (await driver.query(stmt.sql, stmt.params)).rows[0];
			if (!row) return null;
			const invariants = typeof row.invariants === "string" ? JSON.parse(row.invariants) : row.invariants;
			return parseContractMarkerRow({
				...row,
				invariants
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("no such table")) return null;
			throw error;
		}
	}
	async runExpectationSteps(driver, steps, operation, phase) {
		for (const step of steps) {
			const result = await driver.query(step.sql);
			if (!this.stepResultIsTrue(result.rows)) return runnerFailure(phase === "precheck" ? "PRECHECK_FAILED" : "POSTCHECK_FAILED", `Operation ${operation.id} failed during ${phase}: ${step.description}`, { meta: {
				operationId: operation.id,
				phase,
				stepDescription: step.description
			} });
		}
		return okVoid();
	}
	async runExecuteSteps(driver, steps, operation) {
		for (const step of steps) try {
			await driver.query(step.sql);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return runnerFailure("EXECUTION_FAILED", `Operation ${operation.id} failed during execution: ${step.description}`, {
				why: message,
				meta: {
					operationId: operation.id,
					stepDescription: step.description,
					sql: step.sql
				}
			});
		}
		return okVoid();
	}
	stepResultIsTrue(rows) {
		if (!rows || rows.length === 0) return false;
		const firstRow = rows[0];
		const firstValue = firstRow ? Object.values(firstRow)[0] : void 0;
		if (typeof firstValue === "number") return firstValue !== 0;
		if (typeof firstValue === "boolean") return firstValue;
		if (typeof firstValue === "string") {
			const lower = firstValue.toLowerCase();
			if (lower === "true" || lower === "1") return true;
			if (lower === "false" || lower === "0") return false;
			return firstValue.length > 0;
		}
		return Boolean(firstValue);
	}
	async expectationsAreSatisfied(driver, steps) {
		if (steps.length === 0) return false;
		for (const step of steps) {
			const result = await driver.query(step.sql);
			if (!this.stepResultIsTrue(result.rows)) return false;
		}
		return true;
	}
	createSkipRecord(operation) {
		return Object.freeze({
			id: operation.id,
			label: operation.label,
			...ifDefined("summary", operation.summary),
			operationClass: operation.operationClass,
			target: operation.target,
			precheck: Object.freeze([]),
			execute: Object.freeze([]),
			postcheck: Object.freeze([...operation.postcheck]),
			meta: Object.freeze({
				...operation.meta ?? {},
				runner: Object.freeze({
					skipped: true,
					reason: "postcheck_pre_satisfied"
				})
			})
		});
	}
	markerMatchesDestination(marker, plan) {
		if (!marker) return false;
		if (marker.storageHash !== plan.destination.storageHash) return false;
		if (plan.destination.profileHash && marker.profileHash !== plan.destination.profileHash) return false;
		return true;
	}
	enforcePolicyCompatibility(policy, operations) {
		const allowedClasses = new Set(policy.allowedOperationClasses);
		for (const operation of operations) if (!allowedClasses.has(operation.operationClass)) return runnerFailure("POLICY_VIOLATION", `Operation ${operation.id} has class "${operation.operationClass}" which is not allowed by policy.`, {
			why: `Policy only allows: ${policy.allowedOperationClasses.join(", ")}.`,
			meta: {
				operationId: operation.id,
				operationClass: operation.operationClass,
				allowedClasses: policy.allowedOperationClasses
			}
		});
		return okVoid();
	}
	ensureMarkerCompatibility(marker, plan) {
		const origin = plan.origin ?? null;
		if (!origin) return okVoid();
		if (!marker) return runnerFailure("MARKER_ORIGIN_MISMATCH", `Missing contract marker: expected origin storage hash ${origin.storageHash}.`, { meta: { expectedOriginStorageHash: origin.storageHash } });
		if (marker.storageHash !== origin.storageHash) return runnerFailure("MARKER_ORIGIN_MISMATCH", `Existing contract marker (${marker.storageHash}) does not match plan origin (${origin.storageHash}).`, { meta: {
			markerStorageHash: marker.storageHash,
			expectedOriginStorageHash: origin.storageHash
		} });
		if (origin.profileHash && marker.profileHash !== origin.profileHash) return runnerFailure("MARKER_ORIGIN_MISMATCH", `Existing contract marker profile hash (${marker.profileHash}) does not match plan origin profile hash (${origin.profileHash}).`, { meta: {
			markerProfileHash: marker.profileHash,
			expectedOriginProfileHash: origin.profileHash
		} });
		return okVoid();
	}
	ensurePlanMatchesDestinationContract(destination, contract) {
		if (destination.storageHash !== contract.storage.storageHash) return runnerFailure("DESTINATION_CONTRACT_MISMATCH", `Plan destination storage hash (${destination.storageHash}) does not match provided contract storage hash (${contract.storage.storageHash}).`, { meta: {
			planStorageHash: destination.storageHash,
			contractStorageHash: contract.storage.storageHash
		} });
		if (destination.profileHash && contract.profileHash && destination.profileHash !== contract.profileHash) return runnerFailure("DESTINATION_CONTRACT_MISMATCH", `Plan destination profile hash (${destination.profileHash}) does not match provided contract profile hash (${contract.profileHash}).`, { meta: {
			planProfileHash: destination.profileHash,
			contractProfileHash: contract.profileHash
		} });
		return okVoid();
	}
	async upsertMarker(driver, options, existingMarker) {
		const merged = new Set(existingMarker?.invariants ?? []);
		for (const inv of options.plan.providedInvariants) merged.add(inv);
		const invariants = Array.from(merged).sort();
		const writeStatements = buildWriteMarkerStatements({
			storageHash: options.plan.destination.storageHash,
			profileHash: options.plan.destination.profileHash ?? options.destinationContract.profileHash ?? options.plan.destination.storageHash,
			contractJson: options.destinationContract,
			canonicalVersion: null,
			meta: {},
			invariants
		});
		const statement = existingMarker ? writeStatements.update : writeStatements.insert;
		await this.executeStatement(driver, statement);
	}
	async recordLedgerEntry(driver, options, existingMarker, executedOperations) {
		const ledgerStatement = buildLedgerInsertStatement({
			originStorageHash: existingMarker?.storageHash ?? null,
			originProfileHash: existingMarker?.profileHash ?? null,
			destinationStorageHash: options.plan.destination.storageHash,
			destinationProfileHash: options.plan.destination.profileHash ?? options.destinationContract.profileHash ?? options.plan.destination.storageHash,
			contractJsonBefore: existingMarker?.contractJson ?? null,
			contractJsonAfter: options.destinationContract,
			operations: executedOperations
		});
		await this.executeStatement(driver, ledgerStatement);
	}
	async beginExclusiveTransaction(driver) {
		await driver.query("BEGIN EXCLUSIVE");
	}
	async commitTransaction(driver) {
		await driver.query("COMMIT");
	}
	async rollbackTransaction(driver) {
		await driver.query("ROLLBACK");
	}
	async executeStatement(driver, statement) {
		if (statement.params.length > 0) {
			await driver.query(statement.sql, statement.params);
			return;
		}
		await driver.query(statement.sql);
	}
};

//#endregion
//#region src/core/control-target.ts
function sqliteRenderDefault(def, _column) {
	if (def.kind === "function") {
		if (def.expression === "now()") return "datetime('now')";
		return def.expression;
	}
	return renderDefaultLiteral(def.value);
}
const sqliteControlTargetDescriptor = {
	...sqliteTargetDescriptorMeta,
	migrations: {
		createPlanner(_family) {
			return createSqliteMigrationPlanner();
		},
		createRunner(family) {
			return createSqliteMigrationRunner(family);
		},
		contractToSchema(contract, frameworkComponents) {
			return contractToSchemaIR(contract, {
				annotationNamespace: "sqlite",
				renderDefault: sqliteRenderDefault,
				frameworkComponents: frameworkComponents ?? []
			});
		}
	},
	create() {
		return {
			familyId: "sql",
			targetId: "sqlite"
		};
	},
	createPlanner(_family) {
		return createSqliteMigrationPlanner();
	},
	createRunner(family) {
		return createSqliteMigrationRunner(family);
	}
};
var control_target_default = sqliteControlTargetDescriptor;

//#endregion
export { control_target_default as default };
//# sourceMappingURL=control.mjs.map