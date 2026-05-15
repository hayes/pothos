import { t as SqlitePlanTargetDetails } from "./planner-target-details-DTIFFx4L.mjs";
import "./shared-BNtoZqdo.mjs";
import "./sqlite-migration-BYgrMZdR.mjs";
import "./op-factory-call-BPPSCdTB.mjs";
import { n as TypeScriptRenderableSqliteMigration } from "./planner-produced-sqlite-migration-RVneETNy.mjs";
import { MigrationOperationPolicy, SqlMigrationPlanner, SqlPlannerFailureResult } from "@prisma-next/family-sql/control";
import { Contract } from "@prisma-next/contract/types";
import { MigrationPlanner, MigrationScaffoldContext } from "@prisma-next/framework-components/control";
import { TargetBoundComponentDescriptor } from "@prisma-next/framework-components/components";

//#region src/core/migrations/planner.d.ts
declare function createSqliteMigrationPlanner(): SqliteMigrationPlanner;
type SqlitePlanResult = {
  readonly kind: 'success';
  readonly plan: TypeScriptRenderableSqliteMigration;
} | SqlPlannerFailureResult;
/**
 * SQLite migration planner — a thin wrapper over `planIssues`.
 *
 * `plan()` verifies the live schema against the target contract (producing
 * `SchemaIssue[]`) and delegates to `planIssues` with the registered
 * strategies. Strategies absorb groups of related issues into composite
 * recipes (e.g. recreating a table to apply type/nullability/default/
 * constraint changes at once); anything not absorbed by a strategy flows
 * through `mapIssueToCall` in the issue planner as a one-off call.
 *
 * FK-backing indexes are surfaced by `verifySqlSchema`'s index expansion
 * (see `verify-sql-schema.ts:459-469`), so `mapIssueToCall` handles them
 * uniformly alongside user-declared indexes.
 */
declare class SqliteMigrationPlanner implements SqlMigrationPlanner<SqlitePlanTargetDetails>, MigrationPlanner<'sql', 'sqlite'> {
  plan(options: {
    readonly contract: unknown;
    readonly schema: unknown;
    readonly policy: MigrationOperationPolicy;
    /**
     * The "from" contract (state the planner assumes the database starts at),
     * or `null` for reconciliation flows.
     *
     * Typed as the framework `Contract | null` to satisfy the
     * `MigrationPlanner` interface contract; `planSql` narrows to the SQL
     * shape via `SqlMigrationPlannerPlanOptions`. Used to populate
     * `describe().from` on the produced plan as
     * `fromContract?.storage.storageHash ?? null`.
     */
    readonly fromContract: Contract | null;
    readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>>;
  }): SqlitePlanResult;
  emptyMigration(context: MigrationScaffoldContext): TypeScriptRenderableSqliteMigration;
  private planSql;
  private ensureAdditivePolicy;
  private collectSchemaIssues;
}
//#endregion
export { SqliteMigrationPlanner, type SqlitePlanResult, createSqliteMigrationPlanner };
//# sourceMappingURL=planner.d.mts.map