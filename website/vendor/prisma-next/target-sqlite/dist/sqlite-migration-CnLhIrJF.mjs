import { Migration } from "@prisma-next/family-sql/migration";

//#region src/core/migrations/sqlite-migration.ts
/**
* Target-owned base class for SQLite migrations. Fixes the `SqlMigration`
* generic to `SqlitePlanTargetDetails` and the abstract `targetId` to the
* SQLite literal, so both user-authored migrations and renderer-generated
* scaffolds can extend `SqliteMigration` directly without redeclaring
* target-local identity.
*/
var SqliteMigration = class extends Migration {
	targetId = "sqlite";
};

//#endregion
export { SqliteMigration as t };
//# sourceMappingURL=sqlite-migration-CnLhIrJF.mjs.map