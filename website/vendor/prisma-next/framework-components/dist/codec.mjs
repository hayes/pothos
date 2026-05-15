//#region src/shared/codec-types.ts
const emptyCodecLookup = { get: () => void 0 };
/**
* Standard Schema validator for `void` params. Accepts only `undefined`
* (or absent input); rejects any other value so a contract that tries to
* thread `typeParams` through a non-parameterized codec id fails fast at
* the JSON boundary instead of silently coercing the value away. Used by
* the framework-supplied non-parameterized descriptor synthesizer.
*/
const voidParamsSchema = { "~standard": {
	version: 1,
	vendor: "prisma-next",
	validate: (input) => input === void 0 ? { value: void 0 } : { issues: [{ message: "unexpected typeParams for non-parameterized codec (void params expected)" }] }
} };
/**
* Synthesize a `CodecDescriptor<void>` for a non-parameterized codec
* runtime instance. The factory is constant — every call returns the same
* shared codec instance — so columns sharing this codec id share one
* resolved codec.
*
* Codec-registry-unification spec § Decision (Case T — non-parameterized
* text codec). This is the bridge while non-parameterized codec
* contributors still register through the legacy `codecs:` slot; once they
* migrate to ship descriptors directly (TML-2357 T3.5.3), this synthesis
* steps aside.
*/
function synthesizeNonParameterizedDescriptor(codec) {
	const sharedFactory = () => () => codec;
	const codecMeta = codec.meta;
	return {
		codecId: codec.id,
		traits: codec.traits ?? [],
		targetTypes: codec.targetTypes,
		paramsSchema: voidParamsSchema,
		factory: sharedFactory,
		...codecMeta !== void 0 ? { meta: codecMeta } : {}
	};
}

//#endregion
export { emptyCodecLookup, synthesizeNonParameterizedDescriptor, voidParamsSchema };
//# sourceMappingURL=codec.mjs.map