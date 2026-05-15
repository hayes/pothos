//#region src/core/authoring-field-presets.ts
/**
* Family-level SQL authoring field presets.
*
* Only presets whose codec IDs align with the ID generator metadata live here
* (see `@prisma-next/ids`). These presets are target-agnostic because the
* generator metadata fixes their codec/native-type to `sql/char@1`
* (`character`) regardless of target, and the PSL interpreter lets the
* generator override the scalar descriptor.
*
* Scalar presets that map to target-specific codecs (e.g. `text`, `int`,
* `boolean`, `dateTime`) are contributed by the target pack (see
* `postgresAuthoringFieldPresets` in `@prisma-next/target-postgres`) so the
* TS callback surface and the PSL scalar surface lower to byte-identical
* contracts for the active target.
*/
const CHARACTER_CODEC_ID = "sql/char@1";
const CHARACTER_NATIVE_TYPE = "character";
const nanoidOptionsArgument = {
	kind: "object",
	optional: true,
	properties: { size: {
		kind: "number",
		optional: true,
		integer: true,
		minimum: 2,
		maximum: 255
	} }
};
const sqlFamilyAuthoringFieldPresets = {
	uuid: {
		kind: "fieldPreset",
		output: {
			codecId: CHARACTER_CODEC_ID,
			nativeType: CHARACTER_NATIVE_TYPE,
			typeParams: { length: 36 }
		}
	},
	ulid: {
		kind: "fieldPreset",
		output: {
			codecId: CHARACTER_CODEC_ID,
			nativeType: CHARACTER_NATIVE_TYPE,
			typeParams: { length: 26 }
		}
	},
	nanoid: {
		kind: "fieldPreset",
		args: [nanoidOptionsArgument],
		output: {
			codecId: CHARACTER_CODEC_ID,
			nativeType: CHARACTER_NATIVE_TYPE,
			typeParams: { length: {
				kind: "arg",
				index: 0,
				path: ["size"],
				default: 21
			} }
		}
	},
	cuid2: {
		kind: "fieldPreset",
		output: {
			codecId: CHARACTER_CODEC_ID,
			nativeType: CHARACTER_NATIVE_TYPE,
			typeParams: { length: 24 }
		}
	},
	ksuid: {
		kind: "fieldPreset",
		output: {
			codecId: CHARACTER_CODEC_ID,
			nativeType: CHARACTER_NATIVE_TYPE,
			typeParams: { length: 27 }
		}
	},
	id: {
		uuidv4: {
			kind: "fieldPreset",
			output: {
				codecId: CHARACTER_CODEC_ID,
				nativeType: CHARACTER_NATIVE_TYPE,
				typeParams: { length: 36 },
				executionDefault: {
					kind: "generator",
					id: "uuidv4"
				},
				id: true
			}
		},
		uuidv7: {
			kind: "fieldPreset",
			output: {
				codecId: CHARACTER_CODEC_ID,
				nativeType: CHARACTER_NATIVE_TYPE,
				typeParams: { length: 36 },
				executionDefault: {
					kind: "generator",
					id: "uuidv7"
				},
				id: true
			}
		},
		ulid: {
			kind: "fieldPreset",
			output: {
				codecId: CHARACTER_CODEC_ID,
				nativeType: CHARACTER_NATIVE_TYPE,
				typeParams: { length: 26 },
				executionDefault: {
					kind: "generator",
					id: "ulid"
				},
				id: true
			}
		},
		nanoid: {
			kind: "fieldPreset",
			args: [nanoidOptionsArgument],
			output: {
				codecId: CHARACTER_CODEC_ID,
				nativeType: CHARACTER_NATIVE_TYPE,
				typeParams: { length: {
					kind: "arg",
					index: 0,
					path: ["size"],
					default: 21
				} },
				executionDefault: {
					kind: "generator",
					id: "nanoid",
					params: { size: {
						kind: "arg",
						index: 0,
						path: ["size"]
					} }
				},
				id: true
			}
		},
		cuid2: {
			kind: "fieldPreset",
			output: {
				codecId: CHARACTER_CODEC_ID,
				nativeType: CHARACTER_NATIVE_TYPE,
				typeParams: { length: 24 },
				executionDefault: {
					kind: "generator",
					id: "cuid2"
				},
				id: true
			}
		},
		ksuid: {
			kind: "fieldPreset",
			output: {
				codecId: CHARACTER_CODEC_ID,
				nativeType: CHARACTER_NATIVE_TYPE,
				typeParams: { length: 27 },
				executionDefault: {
					kind: "generator",
					id: "ksuid"
				},
				id: true
			}
		}
	}
};

//#endregion
//#region src/core/authoring-type-constructors.ts
const sqlFamilyAuthoringTypes = { sql: { String: {
	kind: "typeConstructor",
	args: [{
		kind: "number",
		name: "length",
		integer: true,
		minimum: 1,
		maximum: 10485760
	}],
	output: {
		codecId: "sql/varchar@1",
		nativeType: "character varying",
		typeParams: { length: {
			kind: "arg",
			index: 0
		} }
	}
} } };

//#endregion
export { sqlFamilyAuthoringFieldPresets as n, sqlFamilyAuthoringTypes as t };
//# sourceMappingURL=authoring-type-constructors-BAR65pSK.mjs.map