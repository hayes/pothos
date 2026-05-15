import { RuntimeTargetInstance } from "@prisma-next/framework-components/execution";
import { SqlRuntimeTargetDescriptor } from "@prisma-next/sql-runtime";

//#region src/core/runtime-target.d.ts
interface SqliteRuntimeTargetInstance extends RuntimeTargetInstance<'sql', 'sqlite'> {}
declare const sqliteRuntimeTargetDescriptor: SqlRuntimeTargetDescriptor<'sqlite', SqliteRuntimeTargetInstance>;
//#endregion
export { type SqliteRuntimeTargetInstance, sqliteRuntimeTargetDescriptor as default };
//# sourceMappingURL=runtime.d.mts.map