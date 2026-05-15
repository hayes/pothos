import { type } from "arktype";

//#region src/core/verify.ts
const MetaSchema = type({ "[string]": "unknown" });
function parseMeta(meta) {
	if (meta === null || meta === void 0) return {};
	let parsed;
	if (typeof meta === "string") try {
		parsed = JSON.parse(meta);
	} catch {
		return {};
	}
	else parsed = meta;
	const result = MetaSchema(parsed);
	if (result instanceof type.errors) return {};
	return result;
}
/**
* SQLite stores `contract_json` as TEXT, so the wire shape is a JSON string;
* Postgres uses `jsonb` and returns an already-parsed value. Normalize both
* here so `ContractMarkerRecord.contractJson` is always the structured form.
*/
function parseContractJson(value) {
	if (value === null || value === void 0) return null;
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}
const ContractMarkerRowSchema = type({
	core_hash: "string",
	profile_hash: "string",
	"contract_json?": "unknown | null",
	"canonical_version?": "number | null",
	"updated_at?": "Date | string",
	"app_tag?": "string | null",
	"meta?": "unknown | null",
	invariants: type("string").array()
});
/**
* Parses a contract marker row from database query result.
* This is SQL-specific parsing logic (handles SQL row structure with snake_case columns).
*/
function parseContractMarkerRow(row) {
	const result = ContractMarkerRowSchema(row);
	if (result instanceof type.errors) {
		const messages = result.map((p) => p.message).join("; ");
		throw new Error(`Invalid contract marker row: ${messages}`);
	}
	const updatedAt = result.updated_at ? result.updated_at instanceof Date ? result.updated_at : new Date(result.updated_at) : /* @__PURE__ */ new Date();
	return {
		storageHash: result.core_hash,
		profileHash: result.profile_hash,
		contractJson: parseContractJson(result.contract_json),
		canonicalVersion: result.canonical_version ?? null,
		updatedAt,
		appTag: result.app_tag ?? null,
		meta: parseMeta(result.meta),
		invariants: result.invariants
	};
}
/**
* Collects supported codec type IDs from adapter and extension manifests.
* Returns a sorted, unique array of type IDs that are declared in the manifests.
* This enables coverage checks by comparing contract column types against supported types.
*
* Note: This extracts type IDs from manifest type imports, not from runtime codec registries.
* The manifests declare which codec types are available, but the actual type IDs
* are defined in the codec-types TypeScript modules that are imported.
*
* For MVP, we return an empty array since extracting type IDs from TypeScript modules
* would require runtime evaluation or static analysis. This can be enhanced later.
*/
function collectSupportedCodecTypeIds(descriptors) {
	return [];
}

//#endregion
export { parseContractMarkerRow as n, collectSupportedCodecTypeIds as t };
//# sourceMappingURL=verify-BdES8wgQ.mjs.map