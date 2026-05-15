//#region src/core/migrations/statement-builders.ts
const MARKER_TABLE_NAME = "_prisma_marker";
const LEDGER_TABLE_NAME = "_prisma_ledger";
/**
* Control tables the runner creates/manages. The planner must not drop these
* when reconciling "extra" tables against the contract.
*/
const CONTROL_TABLE_NAMES = new Set([MARKER_TABLE_NAME, LEDGER_TABLE_NAME]);
const ensureMarkerTableStatement = {
	sql: `CREATE TABLE IF NOT EXISTS _prisma_marker (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    core_hash TEXT NOT NULL,
    profile_hash TEXT NOT NULL,
    contract_json TEXT,
    canonical_version INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    app_tag TEXT,
    meta TEXT NOT NULL DEFAULT '{}',
    invariants TEXT NOT NULL DEFAULT '[]'
  )`,
	params: []
};
const ensureLedgerTableStatement = {
	sql: `CREATE TABLE IF NOT EXISTS _prisma_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    origin_core_hash TEXT,
    origin_profile_hash TEXT,
    destination_core_hash TEXT NOT NULL,
    destination_profile_hash TEXT,
    contract_json_before TEXT,
    contract_json_after TEXT,
    operations TEXT NOT NULL
  )`,
	params: []
};
function readMarkerStatement() {
	return {
		sql: `SELECT
      core_hash,
      profile_hash,
      contract_json,
      canonical_version,
      updated_at,
      app_tag,
      meta,
      invariants
    FROM _prisma_marker
    WHERE id = ?`,
		params: [1]
	};
}
function buildWriteMarkerStatements(input) {
	return {
		insert: {
			sql: `INSERT INTO _prisma_marker (
        id,
        core_hash,
        profile_hash,
        contract_json,
        canonical_version,
        updated_at,
        app_tag,
        meta,
        invariants
      ) VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        datetime('now'),
        ?,
        ?,
        ?
      )`,
			params: [
				1,
				input.storageHash,
				input.profileHash,
				jsonParam(input.contractJson),
				input.canonicalVersion ?? null,
				input.appTag ?? null,
				jsonParam(input.meta ?? {}),
				jsonParam(input.invariants)
			]
		},
		update: {
			sql: `UPDATE _prisma_marker SET
        core_hash = ?,
        profile_hash = ?,
        contract_json = ?,
        canonical_version = ?,
        updated_at = datetime('now'),
        app_tag = ?,
        meta = ?,
        invariants = ?
      WHERE id = ?`,
			params: [
				input.storageHash,
				input.profileHash,
				jsonParam(input.contractJson),
				input.canonicalVersion ?? null,
				input.appTag ?? null,
				jsonParam(input.meta ?? {}),
				jsonParam(input.invariants),
				1
			]
		}
	};
}
function buildLedgerInsertStatement(input) {
	return {
		sql: `INSERT INTO _prisma_ledger (
      origin_core_hash,
      origin_profile_hash,
      destination_core_hash,
      destination_profile_hash,
      contract_json_before,
      contract_json_after,
      operations
    ) VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )`,
		params: [
			input.originStorageHash ?? null,
			input.originProfileHash ?? null,
			input.destinationStorageHash,
			input.destinationProfileHash ?? null,
			jsonParam(input.contractJsonBefore),
			jsonParam(input.contractJsonAfter),
			jsonParam(input.operations)
		]
	};
}
function jsonParam(value) {
	return JSON.stringify(value ?? null);
}

//#endregion
export { buildWriteMarkerStatements as a, readMarkerStatement as c, buildLedgerInsertStatement as i, LEDGER_TABLE_NAME as n, ensureLedgerTableStatement as o, MARKER_TABLE_NAME as r, ensureMarkerTableStatement as s, CONTROL_TABLE_NAMES as t };
//# sourceMappingURL=statement-builders-B3OGOp7n.mjs.map