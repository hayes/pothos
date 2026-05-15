import { t as SqlitePlanTargetDetails } from "./planner-target-details-DTIFFx4L.mjs";
import { Migration } from "@prisma-next/family-sql/migration";

//#region src/core/migrations/sqlite-migration.d.ts

/**
 * Target-owned base class for SQLite migrations. Fixes the `SqlMigration`
 * generic to `SqlitePlanTargetDetails` and the abstract `targetId` to the
 * SQLite literal, so both user-authored migrations and renderer-generated
 * scaffolds can extend `SqliteMigration` directly without redeclaring
 * target-local identity.
 */
declare abstract class SqliteMigration extends Migration<SqlitePlanTargetDetails> {
  readonly targetId: "sqlite";
}
//#endregion
export { SqliteMigration as t };
//# sourceMappingURL=sqlite-migration-BYgrMZdR.d.mts.map