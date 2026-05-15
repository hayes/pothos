//#region src/types.ts
const DEFAULT_FK_CONSTRAINT = true;
const DEFAULT_FK_INDEX = true;
function applyFkDefaults(fk, overrideDefaults) {
	return {
		constraint: fk.constraint ?? overrideDefaults?.constraint ?? DEFAULT_FK_CONSTRAINT,
		index: fk.index ?? overrideDefaults?.index ?? DEFAULT_FK_INDEX
	};
}

//#endregion
export { DEFAULT_FK_INDEX as n, applyFkDefaults as r, DEFAULT_FK_CONSTRAINT as t };
//# sourceMappingURL=types-DRR5stkj.mjs.map