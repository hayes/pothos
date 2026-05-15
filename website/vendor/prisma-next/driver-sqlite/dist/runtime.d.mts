import { DatabaseSync } from "node:sqlite";
import { RuntimeDriverDescriptor, RuntimeDriverInstance } from "@prisma-next/framework-components/execution";
import { SqlDriver } from "@prisma-next/sql-relational-core/ast";

//#region src/sqlite-driver.d.ts
type SqliteBinding = {
  readonly kind: 'path';
  readonly path: string;
};
type SqliteRuntimeDriver = RuntimeDriverInstance<'sql', 'sqlite'> & SqlDriver<SqliteBinding>;
//#endregion
//#region src/core/runtime-driver.d.ts
declare const sqliteRuntimeDriverDescriptor: RuntimeDriverDescriptor<'sql', 'sqlite', void, SqliteRuntimeDriver>;
//#endregion
export { type SqliteBinding, type SqliteRuntimeDriver, sqliteRuntimeDriverDescriptor as default };
//# sourceMappingURL=runtime.d.mts.map