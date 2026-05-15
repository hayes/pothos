import { t as sqliteTargetDescriptorMeta } from "./descriptor-meta-CzGTszoH.mjs";
import { createCodecRegistry } from "@prisma-next/sql-relational-core/ast";

//#region src/core/runtime-target.ts
const sqliteRuntimeTargetDescriptor = {
	...sqliteTargetDescriptorMeta,
	codecs: () => createCodecRegistry(),
	parameterizedCodecs: () => [],
	create() {
		return {
			familyId: "sql",
			targetId: "sqlite"
		};
	}
};
var runtime_target_default = sqliteRuntimeTargetDescriptor;

//#endregion
export { runtime_target_default as default };
//# sourceMappingURL=runtime.mjs.map