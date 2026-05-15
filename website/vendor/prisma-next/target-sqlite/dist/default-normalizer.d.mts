import { ColumnDefault } from "@prisma-next/contract/types";

//#region src/core/default-normalizer.d.ts

declare function parseSqliteDefault(rawDefault: string, nativeType?: string): ColumnDefault | undefined;
//#endregion
export { parseSqliteDefault };
//# sourceMappingURL=default-normalizer.d.mts.map