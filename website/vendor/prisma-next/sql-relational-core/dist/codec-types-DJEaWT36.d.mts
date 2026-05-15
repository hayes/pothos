import { Type } from "arktype";
import { JsonValue } from "@prisma-next/contract/types";
import { Codec, CodecCallContext, CodecCallContext as CodecCallContext$1, CodecInstanceContext, CodecTrait, CodecTrait as CodecTrait$1 } from "@prisma-next/framework-components/codec";
import { O } from "ts-toolbelt";

//#region src/ast/codec-types.d.ts

/**
 * SQL-family addressing of a single column. The decode site populates a
 * `SqlColumnRef` whenever it can resolve the cell to a single underlying
 * `(table, column)` (the typical case for projected columns from a
 * single-table source); cells the runtime cannot resolve (aggregate
 * aliases, include aggregate fields, computed projections without a
 * simple ref) get `column = undefined`.
 *
 * The shape is a structural projection of the runtime's `ColumnRef` so
 * the SQL decode site can reuse the resolution it already performs for
 * `RUNTIME.DECODE_FAILED` envelope construction without allocating
 * twice per cell.
 */
interface SqlColumnRef {
  readonly table: string;
  readonly name: string;
}
/**
 * SQL-family per-call context. Extends the framework {@link CodecCallContext}
 * (which carries `signal` only) with `column?: SqlColumnRef`, populated
 * on **decode** call sites that can resolve a single underlying column
 * ref. Encode call sites currently leave `column` undefined (encode-time
 * column context is the middleware's domain).
 *
 * SQL codec authors writing a `(value, ctx)` author function for the SQL
 * `codec()` factory observe this type. The framework codec dispatch
 * surface (and Mongo) sees only the base `CodecCallContext`.
 */
interface SqlCodecCallContext extends CodecCallContext {
  readonly column?: SqlColumnRef;
}
/**
 * SQL-family per-instance context. Extends the framework
 * {@link CodecInstanceContext} (`name` only) with `usedAt`, the set of
 * `(table, column)` pairs the resolved codec serves.
 *
 * - For `typeRef` columns sharing one named `storage.types` instance, the
 *   array lists every referencing column — a column-scoped stateful codec
 *   (e.g. encryption) can derive aggregated per-instance state across all
 *   the columns sharing the named instance.
 * - For inline-`typeParams` columns, the array has exactly one entry —
 *   the column that owns the inline params.
 * - For shared non-parameterized codecs, the array carries one
 *   representative entry (the column that triggered materialization);
 *   the codec is shared across every column with that codec id, so the
 *   `usedAt` is informational only.
 *
 * SQL extensions consuming `usedAt` (e.g. column-scoped state derivation)
 * type their factory parameter as `SqlCodecInstanceContext`. Extensions
 * that don't read `usedAt` type their factory parameter as the
 * family-agnostic {@link CodecInstanceContext} — a `SqlCodecInstanceContext`
 * is structurally assignable to the base.
 */
interface SqlCodecInstanceContext extends CodecInstanceContext {
  readonly usedAt: ReadonlyArray<{
    readonly table: string;
    readonly column: string;
  }>;
}
/**
 * Legacy adapter-level descriptor for parameterized codecs that require
 * type-parameter validation at compile time. The runtime descriptor
 * (`RuntimeParameterizedCodecDescriptor` in `@prisma-next/sql-runtime`)
 * has migrated to the unified `CodecDescriptor<P>` shape with
 * `factory: (P) => (CodecInstanceContext) => Codec`; this descriptor stays only because
 * the SQL `Adapter.parameterizedCodecs()` surface still returns
 * `CodecParamsDescriptor[]` (compile-time typeParams validation only,
 * not runtime materialization).
 *
 * Retirement is tracked under TML-2357 T3.5.4 (single registration slot)
 * — the adapter-level `parameterizedCodecs()` collapses into the unified
 * runtime descriptor map once contributors migrate fully.
 *
 * @template TParams - The shape of the type parameters (e.g., `{ length: number }`)
 * @template THelper - The type returned by the optional `init` hook
 */
interface CodecParamsDescriptor<TParams = Record<string, unknown>, THelper = unknown> {
  /** The codec ID this descriptor applies to (e.g., 'pg/vector@1') */
  readonly codecId: string;
  /**
   * Arktype schema for validating typeParams.
   * Used to validate both storage.types entries and inline column typeParams.
   */
  readonly paramsSchema: Type<TParams>;
  /**
   * Optional init hook called during runtime context creation.
   * Receives validated params and returns a helper object to be stored in context.types.
   * If not provided, the validated params are stored directly.
   *
   * Predecessor pattern. The runtime descriptor's curried
   * `factory: (P) => (CodecInstanceContext) => Codec` subsumes this hook — per-instance
   * state lives on the resolved codec rather than in a parallel
   * `TypeHelperRegistry` entry. Retirement tracked under TML-2357 T3.5.2
   * (narrow runtime `Codec` interface) and T3.5.4 (single registration
   * slot). Adapter-level callers reading codec-self-carried `init` should
   * migrate to the runtime descriptor map's factory instead.
   */
  readonly init?: (params: TParams) => THelper;
}
/**
 * Codec metadata for database-specific type information.
 * Used for schema introspection and verification.
 */
interface CodecMeta {
  readonly db?: {
    readonly sql?: {
      readonly postgres?: {
        readonly nativeType: string;
      };
    };
  };
}
/**
 * SQL codec — extends the framework codec base with SQL-specific metadata:
 * driver-native type info (`meta.db.sql.<dialect>.nativeType`) and an
 * optional parameterized-codec descriptor (`paramsSchema` + `init`) for
 * codecs that require type-parameter validation (e.g. `pg/vector@1`).
 *
 * `encode` and `decode` are redeclared here to narrow the per-call
 * context to the SQL-family {@link SqlCodecCallContext} (adds
 * `column?: SqlColumnRef`). TypeScript treats method-syntax declarations
 * bivariantly, so the SQL narrowing is structurally compatible with the
 * framework {@link BaseCodec} super-interface.
 *
 * Note: `paramsSchema` and `init` here are the legacy adapter-level slots
 * mirrored from {@link CodecParamsDescriptor}. The runtime materialization
 * path uses `RuntimeParameterizedCodecDescriptor` (in
 * `@prisma-next/sql-runtime`) via the unified `CodecDescriptor<P>` shape;
 * codec-self-carried `paramsSchema`/`init` retire under TML-2357 (T3.5.2
 * narrows the runtime `Codec` interface; T3.5.4 collapses the parallel
 * registration slots).
 *
 * See `Codec` in `@prisma-next/framework-components/codec` for the codec
 * contract that this interface extends.
 */
interface Codec$1<Id$1 extends string = string, TTraits$1 extends readonly CodecTrait[] = readonly CodecTrait[], TWire = unknown, TInput = unknown, TParams = Record<string, unknown>, THelper = unknown> extends Codec<Id$1, TTraits$1, TWire, TInput> {
  encode(value: TInput, ctx: SqlCodecCallContext): Promise<TWire>;
  decode(wire: TWire, ctx: SqlCodecCallContext): Promise<TInput>;
  readonly meta?: CodecMeta;
  readonly paramsSchema?: Type<TParams>;
  /**
   * Predecessor init hook. Retirement tracked under TML-2357 (T3.5.2 /
   * T3.5.4); the unified runtime descriptor's
   * `factory: (P) => (CodecInstanceContext) => Codec` is the replacement.
   */
  readonly init?: (params: TParams) => THelper;
}
/**
 * Contract-bound codec registry.
 *
 * The dispatch interface for encode/decode at runtime: built once at
 * `ExecutionContext` construction time by walking the contract's
 * `storage.tables[].columns[]` and resolving each column to either a per-
 * instance parameterized codec (via `descriptor.factory(typeParams)(ctx)`)
 * or the shared codec instance from the legacy `CodecRegistry` (for non-
 * parameterized codecs). The dispatch path calls
 * `forColumn(table, column).encode/decode(...)` and doesn't know whether
 * the codec is parameterized.
 *
 * `forCodecId(codecId)` is a fallback for sites that don't carry the
 * `(table, column)` ref through to the encode/decode call site —
 * primarily the param-encoding path, where `ParamRef.refs` is not
 * populated by the SQL builder today (every `ParamRef` carries `codecId`
 * but not the column it relates to). For the parameterized codecs shipped
 * at Phase B, encode is per-instance-stateless (pgvector formats
 * `[v1,v2,v3]` regardless of length; JSON's `encode` is `JSON.stringify`
 * regardless of schema), so a codec-id-keyed lookup yields a structurally
 * equivalent encoder; the fallback is the bridge that lets the legacy
 * `codecs:` registration retire from the dispatch path while staying as
 * the codec-id-only source for now.
 *
 * The encode-side fallback is the AC-5-deferred carve-out documented in
 * the codec-registry-unification spec § Non-functional constraints.
 * TML-2357 retires the fallback by threading `ParamRef.refs` through
 * column-bound construction sites.
 */
interface ContractCodecRegistry {
  /**
   * Resolve the codec for `(table, column)`. Returns the per-instance
   * parameterized codec for parameterized columns, the shared codec for
   * non-parameterized columns, or `undefined` if the column is unknown
   * or the codec isn't registered.
   */
  forColumn(table: string, column: string): Codec$1 | undefined;
  /**
   * Resolve a codec by id. Returns the same codec instance the legacy
   * `CodecRegistry.get(codecId)` would return — for non-parameterized
   * codecs that's the shared instance; for parameterized codecs that's
   * a representative resolved instance. Used by sites that don't carry
   * `(table, column)` through to the encode/decode call site (the AC-5
   * carve-out path).
   */
  forCodecId(codecId: string): Codec$1 | undefined;
}
/**
 * Registry interface for codecs organized by ID and by contract scalar type.
 *
 * The registry allows looking up codecs by their namespaced ID or by the
 * contract scalar types they handle. Multiple codecs may handle the same
 * scalar type; ordering in byScalar reflects preference (adapter first,
 * then packs, then app overrides).
 */
interface CodecRegistry {
  get(id: string): Codec$1<string> | undefined;
  has(id: string): boolean;
  getByScalar(scalar: string): readonly Codec$1<string>[];
  getDefaultCodec(scalar: string): Codec$1<string> | undefined;
  register(codec: Codec$1<string>): void;
  /** Returns true if the codec with this ID has the given trait. */
  hasTrait(codecId: string, trait: CodecTrait): boolean;
  /** Returns all traits for a codec, or an empty array if not found. */
  traitsOf(codecId: string): readonly CodecTrait[];
  [Symbol.iterator](): Iterator<Codec$1<string>>;
  values(): IterableIterator<Codec$1<string>>;
}
/**
 * Conditional bundle for `encodeJson`/`decodeJson`: when `TInput` is
 * structurally assignable to `JsonValue` the identity defaults are
 * sound and both fields are optional; otherwise both fields are
 * required so an author cannot silently produce a non-JSON-safe
 * contract artifact.
 */
type JsonRoundTripConfig<TInput> = [TInput] extends [JsonValue] ? {
  encodeJson?: (value: TInput) => JsonValue;
  decodeJson?: (json: JsonValue) => TInput;
} : {
  encodeJson: (value: TInput) => JsonValue;
  decodeJson: (json: JsonValue) => TInput;
};
/**
 * Construct a SQL codec from author functions and optional metadata.
 *
 * Author `encode` and `decode` as sync or async functions; the factory
 * produces a {@link Codec} whose query-time methods follow the boundary
 * contract documented on `Codec`. Authors receive a second `ctx` options
 * argument carrying the SQL-family per-call context; ignore it if you
 * don't need it.
 *
 * Both `encode` and `decode` are required so `TInput` and `TWire` are
 * always covered by an explicit author function — the factory installs
 * no identity fallback. `encodeJson` and `decodeJson` default to identity
 * **only when `TInput` is assignable to `JsonValue`**; otherwise both are
 * required so the contract artifact stays JSON-safe.
 */
declare function codec<Id$1 extends string, const TTraits$1 extends readonly CodecTrait[] = readonly [], TWire = unknown, TInput = unknown, TParams = Record<string, unknown>, THelper = unknown>(config: {
  typeId: Id$1;
  targetTypes: readonly string[];
  encode: (value: TInput, ctx: SqlCodecCallContext) => TWire | Promise<TWire>;
  decode: (wire: TWire, ctx: SqlCodecCallContext) => TInput | Promise<TInput>;
  meta?: CodecMeta;
  paramsSchema?: Type<TParams>;
  init?: (params: TParams) => THelper;
  traits?: TTraits$1;
  renderOutputType?: (typeParams: Record<string, unknown>) => string | undefined;
} & JsonRoundTripConfig<TInput>): Codec$1<Id$1, TTraits$1, TWire, TInput, TParams, THelper>;
/**
 * Type helpers to extract codec types.
 */
type CodecId<T> = T extends Codec$1<infer Id> ? Id : T extends {
  readonly id: infer Id;
} ? Id : never;
type CodecInput<T> = T extends Codec$1<string, readonly CodecTrait[], unknown, infer In> ? In : never;
type CodecTraits<T> = T extends Codec$1<string, infer TTraits> ? TTraits[number] & CodecTrait : never;
/**
 * Type helper to extract codec types from builder instance.
 */
type ExtractCodecTypes<ScalarNames extends { readonly [K in keyof ScalarNames]: Codec$1<string> } = Record<never, never>> = { readonly [K in keyof ScalarNames as ScalarNames[K] extends Codec$1<infer Id> ? Id : never]: {
  readonly input: CodecInput<ScalarNames[K]>;
  readonly output: CodecInput<ScalarNames[K]>;
  readonly traits: CodecTraits<ScalarNames[K]>;
} };
/**
 * Type helper to extract data type IDs from builder instance.
 * Uses ExtractCodecTypes which preserves literal types as keys.
 * Since ExtractCodecTypes<Record<K, ScalarNames[K]>> has exactly one key (the Id),
 * we extract it by creating a mapped type that uses the Id as both key and value,
 * then extract the value type. This preserves literal types.
 */
type ExtractDataTypes<ScalarNames extends { readonly [K in keyof ScalarNames]: Codec$1<string> }> = { readonly [K in keyof ScalarNames]: { readonly [Id in keyof ExtractCodecTypes<Record<K, ScalarNames[K]>>]: Id }[keyof ExtractCodecTypes<Record<K, ScalarNames[K]>>] };
/**
 * Builder interface for declaring codecs.
 */
interface CodecDefBuilder<ScalarNames extends { readonly [K in keyof ScalarNames]: Codec$1<string> } = Record<never, never>> {
  readonly CodecTypes: ExtractCodecTypes<ScalarNames>;
  add<ScalarName extends string, CodecImpl extends Codec$1<string>>(scalarName: ScalarName, codecImpl: CodecImpl): CodecDefBuilder<O.Overwrite<ScalarNames, Record<ScalarName, CodecImpl>> & Record<ScalarName, CodecImpl>>;
  readonly codecDefinitions: { readonly [K in keyof ScalarNames]: {
    readonly typeId: ScalarNames[K] extends Codec$1<infer Id extends string> ? Id : never;
    readonly scalar: K;
    readonly codec: ScalarNames[K];
    readonly input: CodecInput<ScalarNames[K]>;
    readonly output: CodecInput<ScalarNames[K]>;
    readonly jsType: CodecInput<ScalarNames[K]>;
  } };
  readonly dataTypes: { readonly [K in keyof ScalarNames]: { readonly [Id in keyof ExtractCodecTypes<Record<K, ScalarNames[K]>>]: Id }[keyof ExtractCodecTypes<Record<K, ScalarNames[K]>>] };
}
/**
 * Create a new codec registry.
 */
declare function createCodecRegistry(): CodecRegistry;
/**
 * Create a new codec definition builder.
 */
declare function defineCodecs(): CodecDefBuilder<Record<never, never>>;
//#endregion
export { codec as _, CodecInput as a, CodecRegistry as c, ContractCodecRegistry as d, ExtractCodecTypes as f, SqlColumnRef as g, SqlCodecInstanceContext as h, CodecId as i, CodecTrait$1 as l, SqlCodecCallContext as m, CodecCallContext$1 as n, CodecMeta as o, ExtractDataTypes as p, CodecDefBuilder as r, CodecParamsDescriptor as s, Codec$1 as t, CodecTraits as u, createCodecRegistry as v, defineCodecs as y };
//# sourceMappingURL=codec-types-DJEaWT36.d.mts.map