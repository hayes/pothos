import { ContractMarkerRecord } from "@prisma-next/contract/types";

//#region src/core/verify.d.ts

/**
 * Wire shape of a `prisma_contract.marker` row as it comes out of a SQL
 * driver. Snake-cased to match the on-disk column names. Shared by every
 * SQL target's `readMarker` so each runner doesn't redeclare it inline.
 */
type ContractMarkerRow = {
  core_hash: string;
  profile_hash: string;
  contract_json: unknown | null;
  canonical_version: number | null;
  updated_at: Date | string;
  app_tag: string | null;
  meta: unknown | null;
  invariants: unknown;
};
/**
 * Parses a contract marker row from database query result.
 * This is SQL-specific parsing logic (handles SQL row structure with snake_case columns).
 */
declare function parseContractMarkerRow(row: unknown): ContractMarkerRecord;
//#endregion
export { type ContractMarkerRow, parseContractMarkerRow };
//# sourceMappingURL=verify.d.mts.map