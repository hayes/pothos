import { A as StorageColumn, D as SqlModelStorage, E as SqlModelFieldStorage, F as UniqueConstraint, _ as PrimaryKey, f as ForeignKey, h as Index, j as StorageTable, p as ForeignKeyOptions } from "./types-D1QODyT3.mjs";
import { ScalarFieldType } from "@prisma-next/contract/types";

//#region src/factories.d.ts
declare function col(nativeType: string, codecId: string, nullable?: boolean): StorageColumn;
declare function pk(...columns: readonly string[]): PrimaryKey;
declare function unique(...columns: readonly string[]): UniqueConstraint;
declare function index(...columns: readonly string[]): Index;
declare function fk(columns: readonly string[], refTable: string, refColumns: readonly string[], opts?: ForeignKeyOptions & {
  constraint?: boolean;
  index?: boolean;
}): ForeignKey;
declare function table(columns: Record<string, StorageColumn>, opts?: {
  pk?: PrimaryKey;
  uniques?: readonly UniqueConstraint[];
  indexes?: readonly Index[];
  fks?: readonly ForeignKey[];
}): StorageTable;
declare function model(tableName: string, fields: Record<string, SqlModelFieldStorage>, relations?: Record<string, unknown>): {
  storage: SqlModelStorage;
  fields: Record<string, {
    readonly nullable: boolean;
    readonly type: ScalarFieldType;
  }>;
  relations: Record<string, unknown>;
};
//#endregion
export { col, fk, index, model, pk, table, unique };
//# sourceMappingURL=factories.d.mts.map