import { ifDefined } from "@prisma-next/utils/defined";
import { pathToFileURL } from "node:url";
import { ok } from "@prisma-next/utils/result";

//#region src/config-types.ts
function typescriptContract(contract, output) {
	return {
		source: { load: async () => ok(contract) },
		...ifDefined("output", output)
	};
}
function typescriptContractFromPath(contractPath, output) {
	return {
		source: {
			inputs: [contractPath],
			load: async (context) => {
				const [absolutePath] = context.resolvedInputs;
				if (absolutePath === void 0) throw new Error("typescriptContractFromPath: context.resolvedInputs is empty. The CLI config loader should populate it positional-matched with source.inputs.");
				const mod = await import(pathToFileURL(absolutePath).href);
				const contract = mod.default ?? mod.contract;
				if (contract === void 0) throw new Error(`typescriptContractFromPath: module at "${absolutePath}" has no "default" or "contract" export.`);
				return ok(contract);
			}
		},
		...ifDefined("output", output)
	};
}

//#endregion
export { typescriptContract, typescriptContractFromPath };
//# sourceMappingURL=config-types.mjs.map