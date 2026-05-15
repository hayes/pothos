//#region src/core/sql-utils.ts
/**
* Shared SQL utility functions for the SQLite target.
*
* These functions handle safe SQL identifier and literal escaping. They
* live in `target-sqlite` (mirroring `target-postgres/src/core/sql-utils.ts`)
* so both the control adapter (used at emit time) and the runtime adapter
* (used at execute time) can depend on them through a single one-way edge:
* `adapter-sqlite → target-sqlite`. Hosting them target-side avoids the
* cyclic workspace dependency that would arise if `target-sqlite` reached
* back into `adapter-sqlite` for these primitives.
*/
var SqlEscapeError = class extends Error {
	constructor(message, value, kind) {
		super(message);
		this.value = value;
		this.kind = kind;
		this.name = "SqlEscapeError";
	}
};
function quoteIdentifier(identifier) {
	if (identifier.length === 0) throw new SqlEscapeError("Identifier cannot be empty", identifier, "identifier");
	if (identifier.includes("\0")) throw new SqlEscapeError("Identifier cannot contain null bytes", identifier.replace(/\0/g, "\\0"), "identifier");
	return `"${identifier.replace(/"/g, "\"\"")}"`;
}
function escapeLiteral(value) {
	if (value.includes("\0")) throw new SqlEscapeError("Literal value cannot contain null bytes", value.replace(/\0/g, "\\0"), "literal");
	return value.replace(/'/g, "''");
}

//#endregion
export { escapeLiteral as n, quoteIdentifier as r, SqlEscapeError as t };
//# sourceMappingURL=sql-utils-D3SMPFDD.mjs.map