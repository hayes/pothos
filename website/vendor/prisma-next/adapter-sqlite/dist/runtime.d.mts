import "./types-BFRXGAgd.mjs";
import { t as createSqliteAdapter } from "./adapter-CjuvmCVF.mjs";
import { SqlRuntimeAdapterDescriptor } from "@prisma-next/sql-runtime";
import { RuntimeAdapterInstance } from "@prisma-next/framework-components/execution";

//#region src/core/runtime-adapter.d.ts
type SqliteRuntimeAdapterInstance = RuntimeAdapterInstance<'sql', 'sqlite'> & ReturnType<typeof createSqliteAdapter>;
declare const sqliteRuntimeAdapterDescriptor: SqlRuntimeAdapterDescriptor<'sqlite', SqliteRuntimeAdapterInstance>;
//#endregion
export { type SqliteRuntimeAdapterInstance, sqliteRuntimeAdapterDescriptor as default };
//# sourceMappingURL=runtime.d.mts.map