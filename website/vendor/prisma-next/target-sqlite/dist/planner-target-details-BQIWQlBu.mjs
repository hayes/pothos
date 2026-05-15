import { ifDefined } from "@prisma-next/utils/defined";

//#region src/core/migrations/planner-target-details.ts
const DEFAULT_SCHEMA = "main";
function buildTargetDetails(objectType, name, table) {
	return {
		schema: DEFAULT_SCHEMA,
		objectType,
		name,
		...ifDefined("table", table)
	};
}

//#endregion
export { buildTargetDetails as t };
//# sourceMappingURL=planner-target-details-BQIWQlBu.mjs.map