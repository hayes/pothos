import { t as createSqliteAdapter } from "./adapter-DjLhS34S.mjs";
import { t as sqliteAdapterDescriptorMeta } from "./descriptor-meta-DYT9Gt_F.mjs";
import { createCodecRegistry } from "@prisma-next/sql-relational-core/ast";
import { codecDefinitions } from "@prisma-next/target-sqlite/codecs";
import { builtinGeneratorIds } from "@prisma-next/ids";
import { generateId } from "@prisma-next/ids/runtime";

//#region src/core/runtime-adapter.ts
function createSqliteCodecRegistry() {
	const registry = createCodecRegistry();
	for (const definition of Object.values(codecDefinitions)) registry.register(definition.codec);
	return registry;
}
function createSqliteMutationDefaultGenerators() {
	return builtinGeneratorIds.map((id) => ({
		id,
		generate: (params) => {
			return generateId(params ? {
				id,
				params
			} : { id });
		}
	}));
}
const sqliteRuntimeAdapterDescriptor = {
	...sqliteAdapterDescriptorMeta,
	codecs: createSqliteCodecRegistry,
	parameterizedCodecs: () => [],
	mutationDefaultGenerators: createSqliteMutationDefaultGenerators,
	create(_stack) {
		return createSqliteAdapter();
	}
};
var runtime_adapter_default = sqliteRuntimeAdapterDescriptor;

//#endregion
export { runtime_adapter_default as default };
//# sourceMappingURL=runtime.mjs.map