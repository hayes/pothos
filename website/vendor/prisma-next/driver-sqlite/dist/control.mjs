import { n as normalizeSqliteError, t as sqliteDriverDescriptorMeta } from "./descriptor-meta-DJTTyPb-.mjs";
import { DatabaseSync } from "node:sqlite";
import { errorRuntime } from "@prisma-next/errors/execution";

//#region src/core/control-driver.ts
var SqliteControlDriver = class {
	familyId = "sql";
	targetId = "sqlite";
	constructor(db) {
		this.db = db;
	}
	async query(sql, params) {
		try {
			return { rows: this.db.prepare(sql).all(...params ?? []) };
		} catch (error) {
			throw normalizeSqliteError(error);
		}
	}
	async close() {
		this.db.close();
	}
};
const sqliteDriverDescriptor = {
	...sqliteDriverDescriptorMeta,
	async create(pathOrMemory) {
		try {
			const db = new DatabaseSync(pathOrMemory);
			db.exec("PRAGMA foreign_keys = ON");
			return new SqliteControlDriver(db);
		} catch (error) {
			throw errorRuntime("Database connection failed", {
				why: error instanceof Error ? error.message : String(error),
				fix: "Verify the database file path exists and is accessible",
				meta: { path: pathOrMemory }
			});
		}
	}
};
var control_driver_default = sqliteDriverDescriptor;

//#endregion
export { SqliteControlDriver, control_driver_default as default };
//# sourceMappingURL=control.mjs.map