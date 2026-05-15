import { LoweredStatement } from "@prisma-next/sql-relational-core/ast";
import { Contract } from "@prisma-next/contract/types";
import { SqlStorage } from "@prisma-next/sql-contract/types";

//#region src/core/types.d.ts
interface SqliteAdapterOptions {
  readonly profileId?: string;
}
type SqliteContract = Contract<SqlStorage> & {
  readonly target: 'sqlite';
};
type SqliteLoweredStatement = LoweredStatement;
//#endregion
export { SqliteContract as n, SqliteLoweredStatement as r, SqliteAdapterOptions as t };
//# sourceMappingURL=types-BFRXGAgd.d.mts.map