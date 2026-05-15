import { SqlConnectionError, SqlQueryError } from "@prisma-next/sql-errors";

//#region src/normalize-error.ts
const SQLITE_CONSTRAINT_BASE = 19;
const SQLITE_CONSTRAINT_UNIQUE = 2067;
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555;
const SQLITE_CONSTRAINT_FOREIGNKEY = 787;
const SQLITE_CONSTRAINT_NOTNULL = 1299;
const SQLITE_CONSTRAINT_CHECK = 275;
const SQLITE_BUSY = 5;
const SQLITE_LOCKED = 6;
function isConstraintError(errcode) {
	return (errcode & 255) === SQLITE_CONSTRAINT_BASE;
}
function isBusyOrLocked(errcode) {
	const base = errcode & 255;
	return base === SQLITE_BUSY || base === SQLITE_LOCKED;
}
function isSqliteError(error) {
	if (!(error instanceof Error)) return false;
	return error.code === "ERR_SQLITE_ERROR";
}
function constraintNameFromMessage(message) {
	return /constraint failed: (.+)/.exec(message)?.[1];
}
function mapErrCodeToSqlState(errcode) {
	switch (errcode) {
		case SQLITE_CONSTRAINT_UNIQUE:
		case SQLITE_CONSTRAINT_PRIMARYKEY: return "23505";
		case SQLITE_CONSTRAINT_FOREIGNKEY: return "23503";
		case SQLITE_CONSTRAINT_NOTNULL: return "23502";
		case SQLITE_CONSTRAINT_CHECK: return "23514";
		default:
			if (isConstraintError(errcode)) return "23000";
			return "HY000";
	}
}
function normalizeSqliteError(error) {
	if (!(error instanceof Error)) return new Error(String(error));
	if (isSqliteError(error)) {
		const errcode = error.errcode ?? 0;
		if (isBusyOrLocked(errcode)) return new SqlConnectionError(error.message, {
			cause: error,
			transient: true
		});
		const sqlState = mapErrCodeToSqlState(errcode);
		const constraint = constraintNameFromMessage(error.message);
		return new SqlQueryError(error.message, {
			cause: error,
			sqlState,
			...constraint !== void 0 ? { constraint } : {}
		});
	}
	if (error.message.includes("database is locked") || error.message.includes("unable to open database")) return new SqlConnectionError(error.message, {
		cause: error,
		transient: false
	});
	return error;
}

//#endregion
//#region src/core/descriptor-meta.ts
const sqliteDriverDescriptorMeta = {
	kind: "driver",
	familyId: "sql",
	targetId: "sqlite",
	id: "sqlite",
	version: "0.0.1",
	capabilities: {}
};

//#endregion
export { normalizeSqliteError as n, sqliteDriverDescriptorMeta as t };
//# sourceMappingURL=descriptor-meta-DJTTyPb-.mjs.map