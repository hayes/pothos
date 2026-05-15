//#region src/json-to-ts-source.d.ts
/**
 * Pure JSON-to-TypeScript-source printer.
 *
 * This module is the second stage of the codec → TS pipeline:
 *
 *     jsValue  →  codec.encodeJson  →  JsonValue  →  jsonToTsSource  →  TS source text
 *
 * Stage 1 (`codec.encodeJson`) is a codec responsibility — date serialization,
 * opaque domain types (vector, bigint, uuid), JSON canonicalization. Stage 2
 * (this module) is a pure JSON-to-TS printer that must never grow type-specific
 * branches.
 *
 * To render a non-JSON JS value (Date, Vector, BigInt, Buffer, …), encode it
 * through the relevant codec's `encodeJson` first. Adding special cases to
 * this file is not the answer — that's what codecs are for.
 */
type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;
type JsonObject = {
  readonly [key: string]: JsonValue | undefined;
};
/**
 * Render a JSON-compatible value as a TypeScript source-text literal.
 *
 * Accepts `unknown` for ergonomics with structural types (e.g. `ColumnSpec`,
 * `ForeignKeySpec`) whose fields are all JSON-compatible but whose interfaces
 * lack the index signature TypeScript requires for `JsonObject` assignability.
 * Non-JSON values (Date, Symbol, Function, etc.) throw at runtime.
 */
declare function jsonToTsSource(value: unknown): string;
//#endregion
//#region src/ts-expression.d.ts
/**
 * Declarative contribution to the `import` block of a rendered TypeScript
 * source file. Each node in an IR declares which symbols it needs from which
 * modules; the top-level renderer deduplicates across nodes and emits one
 * `import { a, b, c } from "…"` line per module.
 *
 * `kind` defaults to `"named"` (e.g. `import { a } from "m"`). Setting it to
 * `"default"` emits `import a from "m"`. `attributes`, if provided, emits an
 * import attributes clause (`with { type: "json" }`) verbatim — required for
 * JSON module imports in the rendered scaffolds.
 */
interface ImportRequirement {
  readonly moduleSpecifier: string;
  readonly symbol: string;
  readonly kind?: 'named' | 'default';
  readonly attributes?: Readonly<Record<string, string>>;
}
/**
 * Abstract base class for any IR node that can be emitted as a TypeScript
 * expression and declare its own import requirements.
 *
 * A top-level renderer walks an array of these polymorphically, concatenates
 * `renderTypeScript()` results, and aggregates `importRequirements()` into a
 * deduplicated import block.
 */
declare abstract class TsExpression {
  abstract renderTypeScript(): string;
  abstract importRequirements(): readonly ImportRequirement[];
}
//#endregion
//#region src/render-imports.d.ts
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
declare function renderImports(requirements: readonly ImportRequirement[]): string;
//#endregion
export { type ImportRequirement, type JsonObject, type JsonValue, TsExpression, jsonToTsSource, renderImports };
//# sourceMappingURL=index.d.mts.map