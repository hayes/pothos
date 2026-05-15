//#region src/core/descriptor-meta.ts
const sqliteAdapterDescriptorMeta = {
	kind: "adapter",
	familyId: "sql",
	targetId: "sqlite",
	id: "sqlite",
	version: "0.0.1",
	capabilities: { sql: {
		orderBy: true,
		limit: true,
		lateral: false,
		jsonAgg: true,
		returning: true,
		enums: false
	} },
	types: { codecTypes: { import: {
		package: "@prisma-next/adapter-sqlite/codec-types",
		named: "CodecTypes",
		alias: "SqliteTypes"
	} } }
};

//#endregion
export { sqliteAdapterDescriptorMeta as t };
//# sourceMappingURL=descriptor-meta-DYT9Gt_F.mjs.map