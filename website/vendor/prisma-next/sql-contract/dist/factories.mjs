import { r as applyFkDefaults } from "./types-DRR5stkj.mjs";

//#region src/factories.ts
function col(nativeType, codecId, nullable = false) {
	return {
		nativeType,
		codecId,
		nullable
	};
}
function pk(...columns) {
	return { columns };
}
function unique(...columns) {
	return { columns };
}
function index(...columns) {
	return { columns };
}
function fk(columns, refTable, refColumns, opts) {
	return {
		columns,
		references: {
			table: refTable,
			columns: refColumns
		},
		...opts?.name !== void 0 && { name: opts.name },
		...opts?.onDelete !== void 0 && { onDelete: opts.onDelete },
		...opts?.onUpdate !== void 0 && { onUpdate: opts.onUpdate },
		...applyFkDefaults({
			constraint: opts?.constraint,
			index: opts?.index
		})
	};
}
function table(columns, opts) {
	return {
		columns,
		...opts?.pk !== void 0 && { primaryKey: opts.pk },
		uniques: opts?.uniques ?? [],
		indexes: opts?.indexes ?? [],
		foreignKeys: opts?.fks ?? []
	};
}
function model(tableName, fields, relations = {}) {
	return {
		storage: {
			table: tableName,
			fields
		},
		fields: Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, {
			nullable: field.nullable ?? false,
			type: {
				kind: "scalar",
				codecId: field.codecId ?? "core/unknown@1"
			}
		}])),
		relations
	};
}

//#endregion
export { col, fk, index, model, pk, table, unique };
//# sourceMappingURL=factories.mjs.map