//#region src/index.ts
function createOperationRegistry() {
	const operations = Object.create(null);
	return {
		register(descriptor) {
			if (descriptor.method in operations) throw new Error(`Operation "${descriptor.method}" is already registered`);
			if (descriptor.self) {
				const hasCodecId = descriptor.self.codecId !== void 0;
				const hasTraits = descriptor.self.traits !== void 0 && descriptor.self.traits.length > 0;
				if (!hasCodecId && !hasTraits) throw new Error(`Operation "${descriptor.method}" self has neither codecId nor traits`);
				if (hasCodecId && hasTraits) throw new Error(`Operation "${descriptor.method}" self has both codecId and traits`);
			}
			const { method: _method, ...entry } = descriptor;
			operations[descriptor.method] = entry;
		},
		entries() {
			return Object.freeze({ ...operations });
		}
	};
}

//#endregion
export { createOperationRegistry };
//# sourceMappingURL=index.mjs.map