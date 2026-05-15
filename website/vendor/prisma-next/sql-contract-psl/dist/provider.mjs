import { t as interpretPslDocumentToSqlContract } from "./interpreter-iFCRN9nb.mjs";
import { ifDefined } from "@prisma-next/utils/defined";
import { notOk, ok } from "@prisma-next/utils/result";
import { parsePslDocument } from "@prisma-next/psl-parser";
import { readFile } from "node:fs/promises";

//#region src/provider.ts
function buildColumnDescriptorMap(scalarTypeDescriptors, codecLookup) {
	const result = /* @__PURE__ */ new Map();
	for (const [typeName, codecId] of scalarTypeDescriptors) {
		const codec = codecLookup.get(codecId);
		if (!codec) continue;
		const nativeType = codec.targetTypes[0];
		if (nativeType === void 0) continue;
		result.set(typeName, {
			codecId,
			nativeType
		});
	}
	return result;
}
function prismaContract(schemaPath, options) {
	return {
		source: {
			inputs: [schemaPath],
			load: async (context) => {
				const [absoluteSchemaPath] = context.resolvedInputs;
				if (absoluteSchemaPath === void 0) throw new Error("prismaContract: context.resolvedInputs is empty. The CLI config loader should populate it positional-matched with source.inputs.");
				let schema;
				try {
					schema = await readFile(absoluteSchemaPath, "utf-8");
				} catch (error) {
					const message = String(error);
					return notOk({
						summary: `Failed to read Prisma schema at "${schemaPath}"`,
						diagnostics: [{
							code: "PSL_SCHEMA_READ_FAILED",
							message,
							sourceId: schemaPath
						}],
						meta: {
							schemaPath,
							absoluteSchemaPath,
							cause: message
						}
					});
				}
				const document = parsePslDocument({
					schema,
					sourceId: schemaPath
				});
				const scalarTypeDescriptors = buildColumnDescriptorMap(context.scalarTypeDescriptors, context.codecLookup);
				const interpreted = interpretPslDocumentToSqlContract({
					document,
					target: options.target,
					authoringContributions: context.authoringContributions,
					scalarTypeDescriptors,
					...ifDefined("composedExtensionPacks", context.composedExtensionPacks.length > 0 ? [...context.composedExtensionPacks] : void 0),
					...ifDefined("composedExtensionPackRefs", options.composedExtensionPackRefs?.length ? options.composedExtensionPackRefs : void 0),
					controlMutationDefaults: context.controlMutationDefaults
				});
				if (!interpreted.ok) return interpreted;
				return ok(interpreted.value);
			}
		},
		...ifDefined("output", options.output)
	};
}

//#endregion
export { prismaContract };
//# sourceMappingURL=provider.mjs.map