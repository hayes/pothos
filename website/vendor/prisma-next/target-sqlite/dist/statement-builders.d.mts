//#region src/core/migrations/statement-builders.d.ts
interface SqlStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}
declare const MARKER_TABLE_NAME = "_prisma_marker";
declare const LEDGER_TABLE_NAME = "_prisma_ledger";
/**
 * Control tables the runner creates/manages. The planner must not drop these
 * when reconciling "extra" tables against the contract.
 */
declare const CONTROL_TABLE_NAMES: ReadonlySet<string>;
declare const ensureMarkerTableStatement: SqlStatement;
declare const ensureLedgerTableStatement: SqlStatement;
declare function readMarkerStatement(): SqlStatement;
interface WriteMarkerInput {
  readonly storageHash: string;
  readonly profileHash: string;
  readonly contractJson?: unknown;
  readonly canonicalVersion?: number | null;
  readonly appTag?: string | null;
  readonly meta?: Record<string, unknown>;
  /**
   * Invariants to write into `marker.invariants`. Stored as a JSON-encoded
   * TEXT array — SQLite has no native array type. The runner is responsible
   * for merging with the existing column (no SQL-side merge here, unlike
   * Postgres) before passing them in: BEGIN EXCLUSIVE on the migration
   * transaction makes the read-then-merge-then-write sequence safe.
   */
  readonly invariants: readonly string[];
}
declare function buildWriteMarkerStatements(input: WriteMarkerInput): {
  readonly insert: SqlStatement;
  readonly update: SqlStatement;
};
interface LedgerInsertInput {
  readonly originStorageHash?: string | null;
  readonly originProfileHash?: string | null;
  readonly destinationStorageHash: string;
  readonly destinationProfileHash?: string | null;
  readonly contractJsonBefore?: unknown;
  readonly contractJsonAfter?: unknown;
  readonly operations: unknown;
}
declare function buildLedgerInsertStatement(input: LedgerInsertInput): SqlStatement;
//#endregion
export { CONTROL_TABLE_NAMES, LEDGER_TABLE_NAME, MARKER_TABLE_NAME, type SqlStatement, buildLedgerInsertStatement, buildWriteMarkerStatements, ensureLedgerTableStatement, ensureMarkerTableStatement, readMarkerStatement };
//# sourceMappingURL=statement-builders.d.mts.map