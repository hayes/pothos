import { t as SqlitePlanTargetDetails } from "./planner-target-details-DTIFFx4L.mjs";
import { t as SqliteMigration } from "./sqlite-migration-BYgrMZdR.mjs";
import { l as SqliteOpFactoryCall } from "./op-factory-call-BPPSCdTB.mjs";
import { SqlMigrationPlanOperation } from "@prisma-next/family-sql/control";
import { MigrationPlanWithAuthoringSurface } from "@prisma-next/framework-components/control";
import { MigrationMeta } from "@prisma-next/migration-tools/migration";

//#region src/core/migrations/planner-produced-sqlite-migration.d.ts
type Op = SqlMigrationPlanOperation<SqlitePlanTargetDetails>;
interface SqliteMigrationDestinationInfo {
  readonly storageHash: string;
  readonly profileHash?: string;
}
declare class TypeScriptRenderableSqliteMigration extends SqliteMigration implements MigrationPlanWithAuthoringSurface {
  #private;
  constructor(calls: readonly SqliteOpFactoryCall[], meta: MigrationMeta, destination?: SqliteMigrationDestinationInfo);
  get operations(): readonly Op[];
  describe(): MigrationMeta;
  get destination(): SqliteMigrationDestinationInfo;
  renderTypeScript(): string;
}
//#endregion
export { TypeScriptRenderableSqliteMigration as n, SqliteMigrationDestinationInfo as t };
//# sourceMappingURL=planner-produced-sqlite-migration-RVneETNy.d.mts.map