import { t as renderOps } from "./render-ops-CXOv7SRC.mjs";
import { t as SqliteMigration } from "./sqlite-migration-CnLhIrJF.mjs";
import { jsonToTsSource, renderImports } from "@prisma-next/ts-render";
import { ifDefined } from "@prisma-next/utils/defined";
import { detectScaffoldRuntime, shebangLineFor } from "@prisma-next/migration-tools/migration-ts";

//#region src/core/migrations/render-typescript.ts
/**
* Polymorphic TypeScript emitter for the SQLite migration IR. Mirrors the
* Postgres `render-typescript.ts` — different base-class + factory module
* specifier, same overall shape.
*/
/**
* Always-present base imports for the rendered scaffold. Both come from
* `@prisma-next/target-sqlite/migration` so an authored SQLite
* `migration.ts` only needs a single dependency for its base class and
* its CLI entrypoint. Mirrors Postgres's `BASE_IMPORTS`.
*
* - `Migration` — the target-owned re-export fixes the `SqlMigration`
*   generic to `SqlitePlanTargetDetails` and the abstract `targetId` to
*   `'sqlite'`.
* - `MigrationCLI` — the migration-file CLI entrypoint, re-exported from
*   `@prisma-next/cli/migration-cli`. Loads `prisma-next.config.ts`,
*   assembles a `ControlStack`, and instantiates the migration class.
*/
const BASE_IMPORTS = [{
	moduleSpecifier: "@prisma-next/target-sqlite/migration",
	symbol: "Migration"
}, {
	moduleSpecifier: "@prisma-next/target-sqlite/migration",
	symbol: "MigrationCLI"
}];
function renderCallsToTypeScript(calls, meta) {
	const imports = buildImports(calls);
	const operationsBody = calls.map((c) => c.renderTypeScript()).join(",\n");
	return [
		shebangLineFor(detectScaffoldRuntime()),
		imports,
		"",
		"export default class M extends Migration {",
		buildDescribeMethod(meta),
		"  override get operations() {",
		"    return [",
		indent(operationsBody, 6),
		"    ];",
		"  }",
		"}",
		"",
		"MigrationCLI.run(import.meta.url, M);",
		""
	].join("\n");
}
function buildImports(calls) {
	const requirements = [...BASE_IMPORTS];
	for (const call of calls) for (const req of call.importRequirements()) requirements.push(req);
	return renderImports(requirements);
}
function buildDescribeMethod(meta) {
	const lines = [];
	lines.push("  override describe() {");
	lines.push("    return {");
	lines.push(`      from: ${JSON.stringify(meta.from)},`);
	lines.push(`      to: ${JSON.stringify(meta.to)},`);
	if (meta.labels && meta.labels.length > 0) lines.push(`      labels: ${jsonToTsSource(meta.labels)},`);
	lines.push("    };");
	lines.push("  }");
	lines.push("");
	return lines.join("\n");
}
function indent(text, spaces) {
	const pad = " ".repeat(spaces);
	return text.split("\n").map((line) => line.trim() ? `${pad}${line}` : line).join("\n");
}

//#endregion
//#region src/core/migrations/planner-produced-sqlite-migration.ts
var TypeScriptRenderableSqliteMigration = class extends SqliteMigration {
	#calls;
	#meta;
	#destination;
	constructor(calls, meta, destination) {
		super();
		this.#calls = calls;
		this.#meta = meta;
		this.#destination = destination ?? { storageHash: meta.to };
	}
	get operations() {
		return renderOps(this.#calls);
	}
	describe() {
		return this.#meta;
	}
	get destination() {
		return this.#destination;
	}
	renderTypeScript() {
		return renderCallsToTypeScript(this.#calls, {
			from: this.#meta.from,
			to: this.#meta.to,
			...ifDefined("labels", this.#meta.labels)
		});
	}
};

//#endregion
export { TypeScriptRenderableSqliteMigration as t };
//# sourceMappingURL=planner-produced-sqlite-migration-C3AAaQoW.mjs.map