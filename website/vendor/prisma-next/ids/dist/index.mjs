import { ifDefined } from "@prisma-next/utils/defined";

//#region src/generator-ids.ts
const builtinGeneratorIds = [
	"ulid",
	"nanoid",
	"uuidv7",
	"uuidv4",
	"cuid2",
	"ksuid"
];

//#endregion
//#region src/index.ts
function resolveNanoidColumnDescriptor(params) {
	const rawSize = params?.["size"];
	if (rawSize === void 0) return {
		type: {
			codecId: "sql/char@1",
			nativeType: "character"
		},
		typeParams: { length: 21 }
	};
	if (typeof rawSize !== "number" || !Number.isInteger(rawSize) || rawSize < 2 || rawSize > 255) throw new Error("nanoid size must be an integer between 2 and 255");
	return {
		type: {
			codecId: "sql/char@1",
			nativeType: "character"
		},
		typeParams: { length: rawSize }
	};
}
const builtinGeneratorMetadataById = {
	ulid: {
		applicableCodecIds: ["pg/text@1", "sql/char@1"],
		generatedColumnDescriptor: {
			type: {
				codecId: "sql/char@1",
				nativeType: "character"
			},
			typeParams: { length: 26 }
		}
	},
	nanoid: {
		applicableCodecIds: ["pg/text@1", "sql/char@1"],
		generatedColumnDescriptor: {
			type: {
				codecId: "sql/char@1",
				nativeType: "character"
			},
			typeParams: { length: 21 }
		},
		resolveGeneratedColumnDescriptor: resolveNanoidColumnDescriptor
	},
	uuidv7: {
		applicableCodecIds: ["pg/text@1", "sql/char@1"],
		generatedColumnDescriptor: {
			type: {
				codecId: "sql/char@1",
				nativeType: "character"
			},
			typeParams: { length: 36 }
		}
	},
	uuidv4: {
		applicableCodecIds: ["pg/text@1", "sql/char@1"],
		generatedColumnDescriptor: {
			type: {
				codecId: "sql/char@1",
				nativeType: "character"
			},
			typeParams: { length: 36 }
		}
	},
	cuid2: {
		applicableCodecIds: ["pg/text@1", "sql/char@1"],
		generatedColumnDescriptor: {
			type: {
				codecId: "sql/char@1",
				nativeType: "character"
			},
			typeParams: { length: 24 }
		}
	},
	ksuid: {
		applicableCodecIds: ["pg/text@1", "sql/char@1"],
		generatedColumnDescriptor: {
			type: {
				codecId: "sql/char@1",
				nativeType: "character"
			},
			typeParams: { length: 27 }
		}
	}
};
const builtinGeneratorRegistryMetadata = builtinGeneratorIds.map((id) => ({
	id,
	applicableCodecIds: builtinGeneratorMetadataById[id].applicableCodecIds
}));
function resolveBuiltinGeneratedColumnDescriptor(input) {
	const metadata = builtinGeneratorMetadataById[input.id];
	if (metadata.resolveGeneratedColumnDescriptor) return metadata.resolveGeneratedColumnDescriptor(input.params);
	return metadata.generatedColumnDescriptor;
}
function createGeneratedSpec(id, options) {
	const params = options;
	const resolvedDescriptor = resolveBuiltinGeneratedColumnDescriptor({
		id,
		...ifDefined("params", params)
	});
	return {
		type: resolvedDescriptor.type,
		nullable: false,
		...ifDefined("typeParams", resolvedDescriptor.typeParams),
		generated: {
			kind: "generator",
			id,
			...ifDefined("params", params)
		}
	};
}
const ulid = (options) => createGeneratedSpec("ulid", options);
const nanoid = (options) => createGeneratedSpec("nanoid", options);
const uuidv7 = (options) => createGeneratedSpec("uuidv7", options);
const uuidv4 = (options) => createGeneratedSpec("uuidv4", options);
const cuid2 = (options) => createGeneratedSpec("cuid2", options);
const ksuid = (options) => createGeneratedSpec("ksuid", options);

//#endregion
export { builtinGeneratorIds, builtinGeneratorRegistryMetadata, cuid2, ksuid, nanoid, resolveBuiltinGeneratedColumnDescriptor, ulid, uuidv4, uuidv7 };
//# sourceMappingURL=index.mjs.map