import { n as normalizeSqliteError, t as sqliteDriverDescriptorMeta } from "./descriptor-meta-DJTTyPb-.mjs";
import { DatabaseSync } from "node:sqlite";

//#region src/sqlite-driver.ts
function driverError(code, message, details) {
	const error = new Error(message);
	Object.defineProperty(error, "name", {
		value: "RuntimeError",
		configurable: true
	});
	return Object.assign(error, {
		code,
		category: "RUNTIME",
		severity: "error",
		message,
		details
	});
}
const NOT_CONNECTED_MESSAGE = "SQLite driver not connected. Call connect(binding) before acquireConnection or execute.";
const ALREADY_CONNECTED_MESSAGE = "SQLite driver already connected. Call close() before reconnecting with a new binding.";
function toSqliteParams(params) {
	return params ?? [];
}
function openConnection(path) {
	try {
		const db = new DatabaseSync(path);
		db.exec("PRAGMA foreign_keys = ON");
		db.exec("PRAGMA busy_timeout = 5000");
		return db;
	} catch (error) {
		throw normalizeSqliteError(error);
	}
}
var SqliteConnectionImpl = class {
	#db;
	constructor(db) {
		this.#db = db;
	}
	async *execute(request) {
		try {
			const stmt = this.#db.prepare(request.sql);
			for (const row of stmt.iterate(...toSqliteParams(request.params))) yield row;
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async explain(request) {
		try {
			return { rows: this.#db.prepare(`EXPLAIN QUERY PLAN ${request.sql}`).all(...toSqliteParams(request.params)) };
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async query(sql, params) {
		try {
			return { rows: this.#db.prepare(sql).all(...toSqliteParams(params)) };
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async beginTransaction() {
		try {
			this.#db.exec("BEGIN");
			return new SqliteTransactionImpl(this.#db);
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async release() {
		return this.destroy();
	}
	async destroy(_reason) {
		try {
			this.#db.close();
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
};
var SqliteTransactionImpl = class {
	#db;
	constructor(db) {
		this.#db = db;
	}
	async *execute(request) {
		try {
			const stmt = this.#db.prepare(request.sql);
			for (const row of stmt.iterate(...toSqliteParams(request.params))) yield row;
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async explain(request) {
		try {
			return { rows: this.#db.prepare(`EXPLAIN QUERY PLAN ${request.sql}`).all(...toSqliteParams(request.params)) };
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async query(sql, params) {
		try {
			return { rows: this.#db.prepare(sql).all(...toSqliteParams(params)) };
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async commit() {
		try {
			this.#db.exec("COMMIT");
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async rollback() {
		try {
			this.#db.exec("ROLLBACK");
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
};
var SqliteDriver = class {
	familyId = "sql";
	targetId = "sqlite";
	#state;
	constructor(initialState) {
		this.#state = initialState ?? { kind: "unbound" };
	}
	#requireConnected() {
		if (this.#state.kind !== "connected") throw driverError("DRIVER.NOT_CONNECTED", NOT_CONNECTED_MESSAGE);
		return this.#state;
	}
	get state() {
		return this.#state.kind;
	}
	async connect(binding) {
		if (this.#state.kind === "connected") throw driverError("DRIVER.ALREADY_CONNECTED", ALREADY_CONNECTED_MESSAGE, { bindingKind: binding.kind });
		this.#state = {
			kind: "connected",
			path: binding.path,
			conn: new SqliteConnectionImpl(openConnection(binding.path))
		};
	}
	async acquireConnection() {
		const { path } = this.#requireConnected();
		return new SqliteConnectionImpl(openConnection(path));
	}
	async close() {
		if (this.#state.kind !== "connected") return;
		const { conn } = this.#state;
		this.#state = { kind: "closed" };
		await conn.release();
	}
	execute(request) {
		if (this.#state.kind !== "connected") return { [Symbol.asyncIterator]() {
			return { async next() {
				throw driverError("DRIVER.NOT_CONNECTED", NOT_CONNECTED_MESSAGE);
			} };
		} };
		return this.#state.conn.execute(request);
	}
	async explain(request) {
		return this.#requireConnected().conn.explain(request);
	}
	async query(sql, params) {
		return this.#requireConnected().conn.query(sql, params);
	}
};

//#endregion
//#region src/core/runtime-driver.ts
const sqliteRuntimeDriverDescriptor = {
	...sqliteDriverDescriptorMeta,
	create() {
		return new SqliteDriver();
	}
};
var runtime_driver_default = sqliteRuntimeDriverDescriptor;

//#endregion
export { runtime_driver_default as default };
//# sourceMappingURL=runtime.mjs.map