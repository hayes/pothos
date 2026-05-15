import { t as coreHash } from "./types-aMyNgejf.mjs";
import { n as computeProfileHash, r as computeStorageHash, t as computeExecutionHash } from "./hashing-CyaA_Qvf.mjs";
import { ifDefined } from "@prisma-next/utils/defined";

//#region src/testing-factories.ts
const DUMMY_HASH = coreHash("sha256:test");
function createContract(overrides = {}) {
	const target = overrides.target ?? "postgres";
	const targetFamily = overrides.targetFamily ?? "sql";
	const capabilities = overrides.capabilities ?? {};
	const rawStorage = overrides.storage ?? { tables: {} };
	const storageHash = computeStorageHash({
		target,
		targetFamily,
		storage: rawStorage
	});
	const storage = {
		...rawStorage,
		storageHash
	};
	const computedProfileHash = overrides.profileHash ?? computeProfileHash({
		target,
		targetFamily,
		capabilities
	});
	return {
		target,
		targetFamily,
		roots: overrides.roots ?? {},
		models: overrides.models ?? {},
		...ifDefined("valueObjects", overrides.valueObjects),
		storage,
		capabilities,
		extensionPacks: overrides.extensionPacks ?? {},
		...overrides.execution !== void 0 ? { execution: {
			...overrides.execution,
			executionHash: computeExecutionHash({
				target,
				targetFamily,
				execution: overrides.execution
			})
		} } : {},
		profileHash: computedProfileHash,
		meta: overrides.meta ?? {}
	};
}
function createSqlContract(overrides = {}) {
	return createContract({
		target: "postgres",
		targetFamily: "sql",
		storage: overrides.storage ?? { tables: {} },
		...overrides
	});
}

//#endregion
export { DUMMY_HASH, createContract, createSqlContract };
//# sourceMappingURL=testing.mjs.map