import { C as SqlRuntimeAdapterInstance, D as SqlRuntimeTargetDescriptor, E as SqlRuntimeExtensionInstance, S as SqlRuntimeAdapterDescriptor, T as SqlRuntimeExtensionDescriptor, _ as ExecutionContext, f as SqlStatement, u as createRuntime, w as SqlRuntimeDriverInstance } from "../index-_dXSGeho.mjs";
import { ResultType } from "@prisma-next/framework-components/runtime";
import { Adapter, LoweredStatement, SelectAst } from "@prisma-next/sql-relational-core/ast";
import * as _prisma_next_framework_components_execution0 from "@prisma-next/framework-components/execution";
import { RuntimeDriverDescriptor } from "@prisma-next/framework-components/execution";
import { Contract } from "@prisma-next/contract/types";
import { DevDatabase, collectAsync, createDevDatabase, teardownTestDatabase, withClient } from "@prisma-next/test-utils";
import { SqlStorage } from "@prisma-next/sql-contract/types";
import { SqlExecutionPlan, SqlQueryPlan } from "@prisma-next/sql-relational-core/plan";
import { Client } from "pg";

//#region test/utils.d.ts

/**
 * Executes a plan and collects all results into an array.
 * This helper DRYs up the common pattern of executing plans in tests.
 * The return type is inferred from the plan's type parameter.
 */
declare function executePlanAndCollect<P extends SqlExecutionPlan<ResultType<P>> | SqlQueryPlan<ResultType<P>>>(runtime: ReturnType<typeof createRuntime>, plan: P): Promise<ResultType<P>[]>;
/**
 * Drains a plan execution, consuming all results without collecting them.
 * Useful for testing side effects without memory overhead.
 */
declare function drainPlanExecution(runtime: ReturnType<typeof createRuntime>, plan: SqlExecutionPlan | SqlQueryPlan<unknown>): Promise<void>;
/**
 * Executes a SQL statement on a database client.
 */
declare function executeStatement(client: Client, statement: SqlStatement): Promise<void>;
/**
 * Sets up database schema and data, then writes the contract marker.
 * This helper DRYs up the common pattern of database setup in tests.
 */
declare function setupTestDatabase(client: Client, contract: Contract<SqlStorage>, setupFn: (client: Client) => Promise<void>): Promise<void>;
/**
 * Writes a contract marker to the database.
 * This helper DRYs up the common pattern of writing contract markers in tests.
 */
declare function writeTestContractMarker(client: Client, contract: Contract<SqlStorage>): Promise<void>;
/**
 * Creates a test adapter descriptor from a raw adapter.
 * Wraps the adapter in an SqlRuntimeAdapterDescriptor with static contributions
 * derived from the adapter's codec registry.
 */
declare function createTestAdapterDescriptor(adapter: Adapter<SelectAst, Contract<SqlStorage>, LoweredStatement>): SqlRuntimeAdapterDescriptor<'postgres'>;
/**
 * Creates a test target descriptor with empty static contributions.
 */
declare function createTestTargetDescriptor(): SqlRuntimeTargetDescriptor<'postgres'>;
/**
 * Creates an ExecutionContext for testing.
 * This helper DRYs up the common pattern of context creation in tests.
 *
 * Accepts a raw adapter and optional extension descriptors, wrapping the
 * adapter in a descriptor internally for descriptor-first context creation.
 */
declare function createTestContext<TContract extends Contract<SqlStorage>>(contract: TContract, adapter: Adapter<SelectAst, Contract<SqlStorage>, LoweredStatement>, options?: {
  extensionPacks?: ReadonlyArray<SqlRuntimeExtensionDescriptor<'postgres'>>;
}): ExecutionContext<TContract>;
declare function createTestStackInstance(options?: {
  extensionPacks?: ReadonlyArray<SqlRuntimeExtensionDescriptor<'postgres'>>;
  driver?: RuntimeDriverDescriptor<'sql', 'postgres', unknown, SqlRuntimeDriverInstance<'postgres'>>;
}): _prisma_next_framework_components_execution0.ExecutionStackInstance<"sql", "postgres", SqlRuntimeAdapterInstance<"postgres">, SqlRuntimeDriverInstance<"postgres">, SqlRuntimeExtensionInstance<"postgres">>;
/**
 * Creates a stub adapter for testing.
 * This helper DRYs up the common pattern of adapter creation in tests.
 *
 * The stub adapter includes simple codecs for common test types (pg/int4@1, pg/text@1, pg/timestamptz@1)
 * to enable type inference in tests without requiring the postgres adapter package.
 */
declare function createStubAdapter(): Adapter<SelectAst, Contract<SqlStorage>, LoweredStatement>;
declare function createTestContract(contract: Partial<Omit<Contract<SqlStorage>, 'profileHash' | 'storage'>> & {
  storageHash?: string;
  profileHash?: string;
  storage?: Omit<SqlStorage, 'storageHash'>;
}): Contract<SqlStorage>;
//#endregion
export { type DevDatabase, collectAsync, createDevDatabase, createStubAdapter, createTestAdapterDescriptor, createTestContext, createTestContract, createTestStackInstance, createTestTargetDescriptor, drainPlanExecution, executePlanAndCollect, executeStatement, setupTestDatabase, teardownTestDatabase, withClient, writeTestContractMarker };
//# sourceMappingURL=utils.d.mts.map