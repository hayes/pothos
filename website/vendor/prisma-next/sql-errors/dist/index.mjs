//#region src/errors.ts
/**
* SQL query error for query-related failures (syntax errors, constraint violations, permissions).
*/
var SqlQueryError = class SqlQueryError extends Error {
	static ERROR_NAME = "SqlQueryError";
	kind = "sql_query";
	sqlState;
	constraint;
	table;
	column;
	detail;
	constructor(message, options) {
		super(message, { cause: options?.cause });
		this.name = SqlQueryError.ERROR_NAME;
		this.sqlState = options?.sqlState;
		this.constraint = options?.constraint;
		this.table = options?.table;
		this.column = options?.column;
		this.detail = options?.detail;
	}
	/**
	* Type predicate to check if an error is a SqlQueryError.
	*/
	static is(error) {
		return typeof error === "object" && error !== null && Object.hasOwn(error, "kind") && error.kind === "sql_query";
	}
};
/**
* SQL connection error (timeouts, connection resets, etc.).
*/
var SqlConnectionError = class SqlConnectionError extends Error {
	static ERROR_NAME = "SqlConnectionError";
	kind = "sql_connection";
	transient;
	constructor(message, options) {
		super(message, { cause: options?.cause });
		this.name = SqlConnectionError.ERROR_NAME;
		this.transient = options?.transient;
	}
	/**
	* Type predicate to check if an error is a SqlConnectionError.
	*/
	static is(error) {
		return typeof error === "object" && error !== null && Object.hasOwn(error, "kind") && error.kind === "sql_connection";
	}
};

//#endregion
export { SqlConnectionError, SqlQueryError };
//# sourceMappingURL=index.mjs.map