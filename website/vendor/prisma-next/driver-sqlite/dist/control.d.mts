import { DatabaseSync } from "node:sqlite";
import { ControlDriverDescriptor, ControlDriverInstance } from "@prisma-next/framework-components/control";

//#region src/core/control-driver.d.ts
declare class SqliteControlDriver implements ControlDriverInstance<'sql', 'sqlite'> {
  private readonly db;
  readonly familyId: "sql";
  readonly targetId: "sqlite";
  constructor(db: DatabaseSync);
  query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<{
    readonly rows: Row[];
  }>;
  close(): Promise<void>;
}
declare const sqliteDriverDescriptor: ControlDriverDescriptor<'sql', 'sqlite', SqliteControlDriver>;
//#endregion
export { SqliteControlDriver, sqliteDriverDescriptor as default };
//# sourceMappingURL=control.d.mts.map