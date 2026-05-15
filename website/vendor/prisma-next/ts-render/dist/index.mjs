//#region src/json-to-ts-source.ts
/**
* Render a JSON-compatible value as a TypeScript source-text literal.
*
* Accepts `unknown` for ergonomics with structural types (e.g. `ColumnSpec`,
* `ForeignKeySpec`) whose fields are all JSON-compatible but whose interfaces
* lack the index signature TypeScript requires for `JsonObject` assignability.
* Non-JSON values (Date, Symbol, Function, etc.) throw at runtime.
*/
function jsonToTsSource(value) {
	if (value === void 0) return "undefined";
	if (value === null) return "null";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		const items = value.map((v) => jsonToTsSource(v));
		const singleLine = `[${items.join(", ")}]`;
		if (singleLine.length <= 80) return singleLine;
		return `[\n${items.map((i) => `  ${i}`).join(",\n")},\n]`;
	}
	if (typeof value === "object") {
		const entries = Object.entries(value).filter(([, v]) => v !== void 0);
		if (entries.length === 0) return "{}";
		const items = entries.map(([k, v]) => `${renderKey(k)}: ${jsonToTsSource(v)}`);
		const singleLine = `{ ${items.join(", ")} }`;
		if (singleLine.length <= 80) return singleLine;
		return `{\n${items.map((i) => `  ${i}`).join(",\n")},\n}`;
	}
	throw new Error(`jsonToTsSource: unsupported value type "${typeof value}"`);
}
function renderKey(key) {
	if (key === "__proto__") return JSON.stringify(key);
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

//#endregion
//#region src/render-imports.ts
/**
* Render an aggregated `import` block from a flat list of
* `ImportRequirement`s. Each target's migration renderer collects
* requirements polymorphically from its call nodes and pipes them here.
*
* The emitter invariants:
*
* - **One line per module specifier.** Named imports are aggregated and
*   emitted sorted alphabetically; a single default symbol is combined
*   onto the same line when attributes agree (`import def, { a, b } from "m";`).
* - **At most one default symbol per module.** Two conflicting default
*   symbols on the same specifier throw — the user's renderer can't
*   guess which one they meant.
* - **Attribute unanimity per module.** All requirements for the same
*   module specifier must carry the same (or no) `attributes` map.
*   Divergent attribute maps throw — they can't collapse to one line
*   and there's no user-resolvable recovery at this layer.
* - **Deterministic ordering.** Modules are emitted sorted by specifier;
*   within a module, named symbols are emitted sorted alphabetically.
*
* Returns a string containing one import line per module, joined by `\n`
* (no trailing newline). An empty requirement list returns `""`.
*/
function renderImports(requirements) {
	return [...aggregateByModule(requirements).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([moduleSpecifier, group]) => renderModuleImport(moduleSpecifier, group)).join("\n");
}
function aggregateByModule(requirements) {
	const byModule = /* @__PURE__ */ new Map();
	for (const req of requirements) {
		let group = byModule.get(req.moduleSpecifier);
		if (!group) {
			group = {
				named: /* @__PURE__ */ new Set(),
				defaultSymbol: null,
				attributes: null,
				attributesSet: false
			};
			byModule.set(req.moduleSpecifier, group);
		}
		mergeRequirementIntoGroup(req, group);
	}
	return byModule;
}
function mergeRequirementIntoGroup(req, group) {
	if ((req.kind ?? "named") === "default") {
		if (group.defaultSymbol !== null && group.defaultSymbol !== req.symbol) throw new Error(`Conflicting default imports for module "${req.moduleSpecifier}": "${group.defaultSymbol}" and "${req.symbol}". Only one default symbol is allowed per module.`);
		group.defaultSymbol = req.symbol;
	} else group.named.add(req.symbol);
	mergeAttributes(req, group);
}
function mergeAttributes(req, group) {
	const incoming = req.attributes ?? null;
	if (!group.attributesSet) {
		group.attributes = incoming;
		group.attributesSet = true;
		return;
	}
	if (!attributesEqual(group.attributes, incoming)) throw new Error(`Conflicting import attributes for module "${req.moduleSpecifier}": ${stringifyAttributes(group.attributes)} vs ${stringifyAttributes(incoming)}.`);
}
function attributesEqual(a, b) {
	if (a === b) return true;
	if (a === null || b === null) return false;
	const aKeys = Object.keys(a).sort();
	const bKeys = Object.keys(b).sort();
	if (aKeys.length !== bKeys.length) return false;
	for (let i = 0; i < aKeys.length; i++) {
		const key = aKeys[i];
		if (key !== bKeys[i]) return false;
		if (a[key] !== b[key]) return false;
	}
	return true;
}
function stringifyAttributes(attrs) {
	if (attrs === null) return "(none)";
	return `{ ${Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")} }`;
}
function renderModuleImport(moduleSpecifier, group) {
	return `import ${buildImportClause(group)} from '${moduleSpecifier}'${buildAttributesClause(group.attributes)};`;
}
function buildImportClause(group) {
	const named = [...group.named].sort();
	const hasNamed = named.length > 0;
	const hasDefault = group.defaultSymbol !== null;
	if (hasDefault && hasNamed) return `${group.defaultSymbol}, { ${named.join(", ")} }`;
	if (hasDefault) return group.defaultSymbol;
	return `{ ${named.join(", ")} }`;
}
function buildAttributesClause(attrs) {
	if (attrs === null) return "";
	const entries = Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
	if (entries.length === 0) return "";
	return ` with { ${entries.join(", ")} }`;
}

//#endregion
//#region src/ts-expression.ts
/**
* Abstract base class for any IR node that can be emitted as a TypeScript
* expression and declare its own import requirements.
*
* A top-level renderer walks an array of these polymorphically, concatenates
* `renderTypeScript()` results, and aggregates `importRequirements()` into a
* deduplicated import block.
*/
var TsExpression = class {};

//#endregion
export { TsExpression, jsonToTsSource, renderImports };
//# sourceMappingURL=index.mjs.map