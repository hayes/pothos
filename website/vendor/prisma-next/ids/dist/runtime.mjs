import { cuid2 } from "uniku/cuid2";
import { ksuid } from "uniku/ksuid";
import { nanoid } from "uniku/nanoid";
import { ulid } from "uniku/ulid";
import { uuidv4 } from "uniku/uuid/v4";
import { uuidv7 } from "uniku/uuid/v7";

//#region src/generators.ts
function invokeGenerator(generator, params) {
	if (params === void 0) return generator();
	return generator(params);
}
const idGenerators = {
	ulid: (params) => invokeGenerator(ulid, params),
	nanoid: (params) => invokeGenerator(nanoid, params),
	uuidv7: (params) => invokeGenerator(uuidv7, params),
	uuidv4: (params) => invokeGenerator(uuidv4, params),
	cuid2: (params) => invokeGenerator(cuid2, params),
	ksuid: (params) => invokeGenerator(ksuid, params)
};

//#endregion
//#region src/runtime.ts
function isBuiltinGeneratorId(id) {
	return Object.hasOwn(idGenerators, id);
}
function generateId(spec) {
	if (!isBuiltinGeneratorId(spec.id)) throw new Error(`Unknown built-in ID generator "${spec.id}".`);
	return idGenerators[spec.id](spec.params);
}

//#endregion
export { generateId };
//# sourceMappingURL=runtime.mjs.map