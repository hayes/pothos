import { c as createSqlExecutionStack, d as parseContractMarkerRow, i as ensureTableStatement, o as writeContractMarker, r as ensureSchemaStatement, s as createExecutionContext } from "../exports-CrHMfIKo.mjs";
import { codec, createCodecRegistry } from "@prisma-next/sql-relational-core/ast";
import { instantiateExecutionStack } from "@prisma-next/framework-components/execution";
import { coreHash, profileHash } from "@prisma-next/contract/types";
import { builtinGeneratorIds } from "@prisma-next/ids";
import { generateId } from "@prisma-next/ids/runtime";
import { collectAsync, collectAsync as collectAsync$1, createDevDatabase, drainAsyncIterable, teardownTestDatabase, withClient } from "@prisma-next/test-utils";

//#region test/utils.ts
function createTestMutationDefaultGenerators() {
	return builtinGeneratorIds.map((id) => ({
		id,
		generate: (params) => generateId(params ? {
			id,
			params
		} : { id })
	}));
}
/**
* Executes a plan and collects all results into an array.
* This helper DRYs up the common pattern of executing plans in tests.
* The return type is inferred from the plan's type parameter.
*/
async function executePlanAndCollect(runtime, plan) {
	return collectAsync$1(runtime.execute(plan));
}
/**
* Drains a plan execution, consuming all results without collecting them.
* Useful for testing side effects without memory overhead.
*/
async function drainPlanExecution(runtime, plan) {
	return drainAsyncIterable(runtime.execute(plan));
}
/**
* Executes a SQL statement on a database client.
*/
async function executeStatement(client, statement) {
	if (statement.params.length > 0) {
		await client.query(statement.sql, [...statement.params]);
		return;
	}
	await client.query(statement.sql);
}
/**
* Sets up database schema and data, then writes the contract marker.
* This helper DRYs up the common pattern of database setup in tests.
*/
async function setupTestDatabase(client, contract, setupFn) {
	await client.query("drop schema if exists prisma_contract cascade");
	await client.query("create schema if not exists public");
	await setupFn(client);
	await executeStatement(client, ensureSchemaStatement);
	await executeStatement(client, ensureTableStatement);
	await executeStatement(client, writeContractMarker({
		storageHash: contract.storage.storageHash,
		profileHash: contract.profileHash,
		contractJson: contract,
		canonicalVersion: 1
	}).insert);
}
/**
* Writes a contract marker to the database.
* This helper DRYs up the common pattern of writing contract markers in tests.
*/
async function writeTestContractMarker(client, contract) {
	await executeStatement(client, writeContractMarker({
		storageHash: contract.storage.storageHash,
		profileHash: contract.profileHash,
		contractJson: contract,
		canonicalVersion: 1
	}).insert);
}
/**
* Creates a test adapter descriptor from a raw adapter.
* Wraps the adapter in an SqlRuntimeAdapterDescriptor with static contributions
* derived from the adapter's codec registry.
*/
function createTestAdapterDescriptor(adapter) {
	const codecRegistry = adapter.profile.codecs();
	return {
		kind: "adapter",
		id: "test-adapter",
		version: "0.0.1",
		familyId: "sql",
		targetId: "postgres",
		codecs: () => codecRegistry,
		parameterizedCodecs: () => [],
		mutationDefaultGenerators: createTestMutationDefaultGenerators,
		create(_stack) {
			return Object.assign({
				familyId: "sql",
				targetId: "postgres"
			}, adapter);
		}
	};
}
/**
* Creates a test target descriptor with empty static contributions.
*/
function createTestTargetDescriptor() {
	return {
		kind: "target",
		id: "postgres",
		version: "0.0.1",
		familyId: "sql",
		targetId: "postgres",
		codecs: () => createCodecRegistry(),
		parameterizedCodecs: () => [],
		create() {
			return {
				familyId: "sql",
				targetId: "postgres"
			};
		}
	};
}
/**
* Creates an ExecutionContext for testing.
* This helper DRYs up the common pattern of context creation in tests.
*
* Accepts a raw adapter and optional extension descriptors, wrapping the
* adapter in a descriptor internally for descriptor-first context creation.
*/
function createTestContext(contract, adapter, options) {
	return createExecutionContext({
		contract,
		stack: {
			target: createTestTargetDescriptor(),
			adapter: createTestAdapterDescriptor(adapter),
			extensionPacks: options?.extensionPacks ?? []
		}
	});
}
function createTestStackInstance(options) {
	return instantiateExecutionStack(createSqlExecutionStack({
		target: createTestTargetDescriptor(),
		adapter: createTestAdapterDescriptor(createStubAdapter()),
		driver: options?.driver,
		extensionPacks: options?.extensionPacks ?? []
	}));
}
/**
* Creates a stub adapter for testing.
* This helper DRYs up the common pattern of adapter creation in tests.
*
* The stub adapter includes simple codecs for common test types (pg/int4@1, pg/text@1, pg/timestamptz@1)
* to enable type inference in tests without requiring the postgres adapter package.
*/
function createStubAdapter() {
	const codecRegistry = createCodecRegistry();
	codecRegistry.register(codec({
		typeId: "pg/int4@1",
		targetTypes: ["int4"],
		encode: (value) => value,
		decode: (wire) => wire
	}));
	codecRegistry.register(codec({
		typeId: "pg/text@1",
		targetTypes: ["text"],
		encode: (value) => value,
		decode: (wire) => wire
	}));
	codecRegistry.register(codec({
		typeId: "pg/timestamptz@1",
		targetTypes: ["timestamptz"],
		encode: (value) => value,
		decode: (wire) => wire,
		encodeJson: (value) => value.toISOString(),
		decodeJson: (json) => {
			if (typeof json !== "string") throw new Error("expected ISO date string");
			return new Date(json);
		}
	}));
	return {
		profile: {
			id: "stub-profile",
			target: "postgres",
			capabilities: {},
			codecs() {
				return codecRegistry;
			},
			readMarkerStatement() {
				return {
					sql: "select core_hash, profile_hash, contract_json, canonical_version, updated_at, app_tag, meta, invariants from prisma_contract.marker where id = $1",
					params: [1]
				};
			},
			parseMarkerRow: parseContractMarkerRow
		},
		lower(ast, ctx) {
			const sqlText = JSON.stringify(ast);
			return Object.freeze({
				sql: sqlText,
				params: ctx.params ? [...ctx.params] : []
			});
		}
	};
}
function createTestContract(contract) {
	const { execution, ...rest } = contract;
	const storageHashValue = coreHash(rest["storageHash"] ?? "sha256:testcore");
	return {
		target: rest["target"] ?? "postgres",
		targetFamily: rest["targetFamily"] ?? "sql",
		storage: rest["storage"] ? {
			...rest["storage"],
			storageHash: storageHashValue
		} : {
			storageHash: storageHashValue,
			tables: {}
		},
		models: rest["models"] ?? {},
		roots: rest["roots"] ?? {},
		capabilities: rest["capabilities"] ?? {},
		extensionPacks: rest["extensionPacks"] ?? {},
		meta: rest["meta"] ?? {},
		...execution ? { execution } : {},
		profileHash: profileHash(rest["profileHash"] ?? "sha256:testprofile")
	};
}

//#endregion
export { collectAsync, createDevDatabase, createStubAdapter, createTestAdapterDescriptor, createTestContext, createTestContract, createTestStackInstance, createTestTargetDescriptor, drainPlanExecution, executePlanAndCollect, executeStatement, setupTestDatabase, teardownTestDatabase, withClient, writeTestContractMarker };
//# sourceMappingURL=utils.mjs.map