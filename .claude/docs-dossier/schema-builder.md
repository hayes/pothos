# Dossier: SchemaBuilder construction (`SchemaTypes` generic, constructor options, `toSchema`)

Territory: the `SchemaTypes` generic and every key it carries; the constructor
options object and which plugin owns each option; the EXACT relationship between
generic entries and constructor options (resolves ledger **F1**); and `toSchema()`.

All line citations are into the worktree at
`.../scratchpad/pg-audit/packages/...`. Runtime file = `packages/core/src/builder.ts`;
generic/type files under `packages/core/src/types/`.

Convention used below: **[type-level]** = affects only what TypeScript accepts;
**[runtime]** = read by executing code and changes emitted schema / resolver
behavior. Where a fact is both, both halves are stated.

---

## 0. The two objects and how the constructor connects them

- The class is `SchemaBuilder<Types extends SchemaTypes>`; the public constructor
  signature that users actually see is NOT the class signature but a cast applied
  at export in `packages/core/src/index.ts:51-60`:
  ```ts
  new <Types extends Partial<PothosSchemaTypes.UserSchemaTypes> = {}>(
    options: Types extends { Defaults: 'v3' }
      ? AddVersionedDefaultsToBuilderOptions<PothosSchemaTypes.ExtendDefaultTypes<Types>, 'v3'>
      : NormalizeSchemeBuilderOptions<PothosSchemaTypes.ExtendDefaultTypes<Types>>,
  ): PothosSchemaTypes.SchemaBuilder<PothosSchemaTypes.ExtendDefaultTypes<Types>>
  ```
  Load-bearing consequence: **the generic you write (`Types`) is a `Partial<UserSchemaTypes>`,
  and it is run through `ExtendDefaultTypes<Types>` to fill defaults BEFORE it
  becomes the builder's `SchemaTypes`.** `index.ts:55-59`. So `new SchemaBuilder<{ Context: Ctx }>({})`
  is legal — you supply only the keys you care about; core fills the rest.
- The runtime class constructor is `builder.ts:104-128`. It stores `this.options`
  (the normalizer-merged options, see §5) and eagerly derives exactly two stored
  runtime fields: `this.defaultFieldNullability` (`builder.ts:115-120`) and
  `this.defaultInputFieldRequiredness` (`builder.ts:122-127`). **The constructor
  reads three distinct options, not two.** Corrected count and reads:
  - `defaults` — read at `builder.ts:106` (normalizer selection: the reduce checks
    `options.defaults` and, if a matching normalizer exists, `Object.assign`s its
    output) AND again at `builder.ts:120` (`?? options.defaults !== 'v3'`, the
    fallback that sets field nullability when `defaultFieldNullability` is omitted).
    `defaults` is *read* but not stored as its own field — it lives inside
    `this.options`.
  - `defaultFieldNullability` — read at `builder.ts:120`, stored as
    `this.defaultFieldNullability`.
  - `defaultInputFieldRequiredness` — read at `builder.ts:127`, stored as
    `this.defaultInputFieldRequiredness`.
  So the precise statement is: **two stored fields are derived, three options are
  consumed (`defaults`, `defaultFieldNullability`, `defaultInputFieldRequiredness`).**
  The earlier phrasing "no other option is read in the constructor" was false for
  `defaults` and was internally inconsistent with §4.A/§5, which correctly cite 106
  and 120 as constructor reads. Every OTHER option (`plugins`, `notStrict`, and all
  plugin option objects) is read later, lazily, by `toSchema()`/plugins/field builders.

**F1 headline (the real contract):** There is no blanket "constructor argument
carries the runtime config that has to match the generic." What actually exists is
three distinct relationships between a generic key and the options object, and
most generic keys have NONE of them. The three are enumerated in §4. The docs must
describe the mechanism per-key, not as a symmetry.

---

## 1. `SchemaTypes` — the runtime-resolved interface (what the builder carries internally)

The interface the builder is generic over. `packages/core/src/types/schema-types.ts:3-33`:
```ts
export interface SchemaTypes extends PothosSchemaTypes.UserSchemaTypes {
  outputShapes: { String; ID; Int; Float; Boolean }   // all unknown
  inputShapes:  { String; ID; Int; Float; Boolean }   // all unknown
  Objects: {}; Inputs: {}; Interfaces: {};
  Scalars: { String; ID; Int; Float; Boolean : { Input: unknown; Output: unknown } }
  DefaultFieldNullability: boolean;
  DefaultInputFieldRequiredness: boolean;
  InferredFieldOptionsKind: InferredFieldOptionsKind;
  Root: object;
  Context: object;
}
```
Note: `SchemaTypes` extends `PothosSchemaTypes.UserSchemaTypes` and adds two
DERIVED keys not present in the user-facing surface: **`outputShapes` and
`inputShapes`** — computed name→shape maps that field type resolution reads
(`type-params.ts:27-28`, `64-65`). Users never write these; `ExtendDefaultTypes`
computes them (`global/schema-types.ts:94-113`).

## 2. `UserSchemaTypes` — the keys a user may pass in the generic (core set)

`packages/core/src/types/global/schema-types.ts:54-70`. These are the ONLY keys
core defines; plugins add more (§3). Each key, what it does, and its default after
`ExtendDefaultTypes`:

- **`Context`** — `object`. [type-level only] The context object type threaded
  into every resolver as the 3rd arg. Default `{}` (`ExtendDefaultTypes` line 80:
  `Context: PartialTypes['Context'] & {}`). **No constructor counterpart** — the
  runtime context value is supplied at execution time by the GraphQL server
  (`contextValue` in `graphql`'s `execute`), never to `SchemaBuilder`. (Verified: no
  `context` key in `SchemaBuilderOptions`, `global/schema-types.ts:9-25`.)
- **`Root`** — `object`. [type-level only] The root value type for the three
  operation roots (`QueryFieldsShape<Types>` = builder over `Types['Root']`,
  `builder-options.ts:115-117`). Default `{}` (`ExtendDefaultTypes` line 79). No
  constructor counterpart; runtime root value is the `rootValue` passed to `execute`.
- **`Scalars`** — `{ [name]: { Input; Output } }`. [type-level] Declares the
  TS Input/Output shapes for scalar names. Default merges `DefaultScalars`
  (`schema-types.ts:57-63`) via `MergedScalars` (`schema-types.ts:35-47`). **No
  required runtime counterpart in the constructor** — see §4.C. Feeds `inputShapes`/
  `outputShapes` (`global/schema-types.ts:94-108`).
- **`Objects`** — `{}`. [type-level] A map of GraphQL type name → backing (parent)
  shape. `ExtendDefaultTypes` line 76 (`Objects: PartialTypes['Objects'] & {}`)
  merges into `outputShapes` at `global/schema-types.ts:101` (`[K in keyof
  PartialTypes['Objects']]: PartialTypes['Objects'][K]`); `Interfaces` (line 78)
  merges into `outputShapes` at line 102. (Line 77 is `Inputs`, which feeds
  `inputShapes` at line 110, NOT `outputShapes` — do not group 76-77 as one
  outputShapes merge.) Effect: a name registered here becomes usable
  as a string `ObjectParam` (`type-params.ts:118-119`
  `Extract<OutputType<Types>, keyof Types['Objects']>`) and its parent shape is
  looked up by name. **F2 (binding):** registering on `Objects` is for centralizing
  type definitions — it is NOT the mechanism Prisma/Drizzle use to map GraphQL type
  names to ORM model names (that is the separate `PrismaTypes`/`DrizzleRelations`
  generics + those plugins' own machinery, §3). No constructor counterpart.
- **`Interfaces`** — `{}`. [type-level] Same as `Objects` but merged into
  `outputShapes` (line 102) and drives `InterfaceParam` (`type-params.ts:127-128`).
  No constructor counterpart.
- **`Inputs`** — `{}`. [type-level] Name → input shape map; merged into
  `inputShapes` (lines 103-112) with `RecursivelyNormalizeNullableFields` applied.
  No constructor counterpart. (Present in `SchemaTypes` `schema-types.ts:19` and
  merged in `ExtendDefaultTypes` line 78; note `UserSchemaTypes` at
  `global/schema-types.ts:54-70` also lists it via `Inputs: {}`… actually `Inputs`
  is in `SchemaTypes` and `ExtendDefaultTypes` line 78, and `UserSchemaTypes` at
  line 62-64 lists `Objects/Inputs/Interfaces` — confirm below.)
- **`Defaults`** — `'v3' | 'v4'`. [type-level AND has a forced runtime
  counterpart, §4.A]. Selects the default-behavior epoch. `ExtendDefaultTypes`
  line 74: `Defaults: PartialTypes['Defaults'] & SchemaTypes['Defaults']`. Drives:
  default scalar shapes (`MergedScalars`, `schema-types.ts:38`: v3 → `V3DefaultScalars`),
  the default of `DefaultFieldNullability` (line 84-90), and default field
  nullability at runtime (`builder.ts:120`).
- **`DefaultFieldNullability`** — `boolean`. [type-level + forced runtime
  counterpart, §4.A]. The type-level claim about whether output fields default to
  nullable. `ExtendDefaultTypes` line 84-90: v3 → `true` only if you set `true`,
  else `false`; v4 → `false` only if you set `false`, else `true`. So **v4 default
  is `true` (fields nullable by default), v3 default is `false`.**
- **`DefaultInputFieldRequiredness`** — `boolean`. [type-level + forced runtime
  counterpart, §4.A]. `ExtendDefaultTypes` line 91-93: `true` only if you set `true`,
  else `false`. Default `false`.
- **`InferredFieldOptionsKind`** — `keyof PothosSchemaTypes.InferredFieldOptions`
  (`builder-options.ts:335-336`), i.e. `'Resolve' | 'InferredResolver' | ...`
  (extended by plugins). [type-level only] Controls whether field option inference
  expects a `resolve` fn etc. `ExtendDefaultTypes` line 81-83 defaults to `'Resolve'`.
  No constructor counterpart.

Correction to my own bullet above — verify `Inputs` membership precisely:

## 2b. `Inputs` / `Objects` / `Interfaces` exact membership

- `UserSchemaTypes` (`global/schema-types.ts:54-70`) lists: `Defaults`, `Scalars`,
  `Objects`, `Inputs`, `Interfaces`, `Root`, `Context`, `DefaultFieldNullability`,
  `DefaultInputFieldRequiredness`, `InferredFieldOptionsKind`. (`Inputs` is line 62-64
  region — confirmed present: `Objects: {}; Inputs: {}; Interfaces: {};`
  actually the file shows `Objects/Inputs/Interfaces` at lines 62,63,64.) All are
  user-writable generic keys.

---

## 3. Plugin-contributed generic keys (`UserSchemaTypes` augmentations)

Every plugin that needs a type-level input augments `PothosSchemaTypes.UserSchemaTypes`
AND `ExtendDefaultTypes` (to define its default). These become additional legal keys
in the generic. Enumerated from source:

- **`Directives`** (plugin-directives, `global-types.ts:22-30`) — map of directive
  name → `{ locations; args? }`. Default `{}` (line 33). [type-level] Enables typed
  `directives:` field option. Constructor option owned by same plugin: `directives?`
  (§3 options).
- **`PrismaTypes`** (plugin-prisma, `global-types.ts:77-79`) — generated model type
  map. Default `{}`. [type-level] This IS the ORM-name wiring surface (F2). Runtime
  counterpart: the required `prisma:` constructor option (§3 options).
- **`DrizzleRelations`** (plugin-drizzle, `global-types.ts:50-52`) —
  `TablesRelationalConfig`. Runtime counterpart: required `drizzle:` option.
- **`AuthScopes`, `AuthContexts`, `DefaultAuthStrategy`** (plugin-scope-auth,
  `global-types.ts:60-64`). `DefaultAuthStrategy` defaults to `'any'` (line 69-71).
- **`Connection`, `DefaultEdgesNullability`, `DefaultNodeNullability`**
  (plugin-relay, `global-types.ts:68-72`). Relay's nullability defaults are
  version-sensitive (line 74-86).
- **`Tracing`** (plugin-tracing, `global-types.ts:29-30`) — `unknown`; defaults to
  `boolean` if unset (line 34). Referenced by the `tracing.default` option type.
- **`SubGraphs`** (plugin-sub-graph, `global-types.ts:92-93`) — `string`. Referenced
  by `subGraphs`/`subGraph` options.
- **`FederationScopes`, `FederationPolicies`** (plugin-federation,
  `global-types.ts:138-141`) — default to `string` (line 143-150).
- **`WithInputArgRequired`** (plugin-with-input, `global-types.ts:20-22`) — defaults
  to `true` (line 25-27).

Docs guidance: present the generic as a small core set (§2) plus plugin-added keys
that appear only when that plugin is installed. This mirrors how the constructor
options grow (§3 options).

---

## 3-options. Constructor options object — every top-level option and its owner

Core owns the interface `PothosSchemaTypes.SchemaBuilderOptions<Types>`
(`global/schema-types.ts:9-25`). Plugins augment it by declaration merging. Full
enumeration:

### Core-owned options (`global/schema-types.ts:9-25`)
- **`plugins?: (keyof PluginConstructorMap<Types>)[]`** (line 10) — [runtime] the
  ordered list of plugin names to activate. Read in `build-cache.ts:107` at
  `toSchema()` time; each name is looked up in the static `SchemaBuilder.plugins`
  registry (`builder.ts:82`, populated by `registerPlugin`, `builder.ts:130-148`).
  Unknown name → throw `No plugin named ${pluginName} was registered`
  (`build-cache.ts:112-113`). **No generic counterpart.** Order matters: it sets
  plugin wrapping order (`MergedPlugins`, `build-cache.ts:121`).
- **`defaultFieldNullability`** (line 11-17) — see §4.A. Type is `never` (→ omit)
  unless the generic `DefaultFieldNullability` is set to a non-default value.
- **`defaultInputFieldRequiredness`** (line 18-20) — see §4.A. `never` unless generic
  set non-default.
- **`notStrict`** (line 21-23) — [type-level ONLY; never read at runtime — verified:
  the only hit in `packages/core/src` is the type definition itself]. Its type is
  `never` when `IsStrictMode extends true` (`utils.ts:134` `IsStrictMode = undefined extends {} ? false : true`),
  otherwise a string literal error message. Effect: if your tsconfig is not strict,
  the option becomes *required* and its only legal value is the warning string,
  forcing you to acknowledge it. Purely a type guard.
- **`defaults`** (line 24) — see §4.A. `never` unless you narrow `Defaults` in the
  generic (i.e., to `'v3'`).

### Plugin-owned options (declaration-merged into `SchemaBuilderOptions`)
Required (NO `?` — becomes a required constructor key the moment the plugin package
is imported, independent of the `plugins` array):
- **`prisma`** — plugin-prisma (`global-types.ts:43-75`). Object with `client`,
  `dmmf`, and tuning (`filterConnectionTotalCount?`, `exposeDescriptions?`,
  `onUnusedQuery?`, `maxConnectionSize?`, `defaultConnectionSize?`,
  `skipDeferredFragments?`). `client` may be a value or `(ctx) => PrismaClient`.
- **`drizzle`** — plugin-drizzle (`global-types.ts:46-48`), `DrizzlePluginOptions`.
- **`scopeAuth`** — plugin-scope-auth (`global-types.ts:38-40`),
  `ScopeAuthPluginOptions`. (Under `defaults:'v3'` this flips: `scopeAuth: never`
  and instead `authScopes` is required — see §5 and `scope-auth/global-types.ts:42-46`.)
- **`smartSubscriptions`** — plugin-smart-subscriptions (`global-types.ts:22-24`),
  `SmartSubscriptionOptions<Types['Context']>`.

Optional (`?`):
- **`relay?`** — plugin-relay (`global-types.ts:59-61`), `RelayPluginOptions`.
- **`errors?`** — plugin-errors (`global-types.ts:28-30`), `ErrorsPluginOptions`.
- **`tracing?`** — plugin-tracing (`global-types.ts:18-27`), `{ default; wrap }`;
  `default` typed against the `Tracing` generic. Read at runtime
  `plugin-tracing/src/index.ts:22,26`.
- **`complexity?`** — plugin-complexity (`global-types.ts:17-19`). (Also appears on
  `BuildSchemaOptions`, §6.)
- **`validation?`** — plugin-validation (`global-types.ts:49-51`).
- **`zod?`** — plugin-zod (`global-types.ts:20-22`) (legacy validation plugin).
- **`withInput?`** — plugin-with-input (`global-types.ts:33-35`).
- **`directives?`** — plugin-directives (`global-types.ts:36-40`),
  `{ useGraphQLToolsUnorderedDirectives? }`.
- **`add?`** — plugin-add-graphql (`global-types.ts:27-32`),
  `{ schema?; types? }`.
- **`subGraphs?`** — plugin-sub-graph (`global-types.ts:80-90`), defaults for
  sub-graph inclusion.

Docs guidance: the option object is *open* — its shape is the union of core keys
plus whatever installed plugins merged in. This is why a bare
`new SchemaBuilder({})` is valid in core but becomes a type error (missing `prisma`)
once `@pothos/plugin-prisma` is imported.

---

## 4. F1 RESOLVED — the exact generic↔option relationship, by category

There are exactly three categories. Assigning every generic key and every option to
one of them IS the contract the ledger asks for.

### 4.A — Generic key with a *forced, type-level-locked* runtime option counterpart
Only three keys. Mechanism: the option's type in `SchemaBuilderOptions` is computed
from the generic and collapses to `never` when the generic holds its default; a
top-level `RemoveNeverKeys` (`builder-options.ts:40-42`,
`NormalizeSchemeBuilderOptions = RemoveNeverKeys<SchemaBuilderOptions<Types>>`;
`RemoveNeverKeys` at `utils.ts:98-100`) then DROPS never-typed keys so they are
neither required nor accepted. When the generic is set to a non-default value, the
option type becomes the exact literal of that value, making the option **required and
constrained to match**.

- **`DefaultFieldNullability` ↔ `defaultFieldNullability`.**
  `global/schema-types.ts:11-17`: for v4, `true extends Types['DefaultFieldNullability'] ? never : Types[...]`.
  If you write `DefaultFieldNullability: false` in the generic, the option becomes
  required and must be literally `false`. Runtime read: `builder.ts:115-120`
  `options.defaultFieldNullability ?? options.defaults !== 'v3'`. **Both halves:**
  the type FORCES agreement; the runtime value that actually drives field nullability
  is the *option*, not the generic (the generic is only a type-level assertion). The
  option default (when omitted, only possible when generic is default) is derived
  from `defaults`.
- **`DefaultInputFieldRequiredness` ↔ `defaultInputFieldRequiredness`.**
  `global/schema-types.ts:18-20`. Runtime read: `builder.ts:122-127`
  (`?? false`); consumed in `fieldUtils/input.ts:139,161`.
- **`Defaults` ↔ `defaults`.** `global/schema-types.ts:24`:
  `SchemaTypes['Defaults'] extends Types['Defaults'] ? never : Types['Defaults']`.
  Setting `Defaults:'v3'` in the generic makes `defaults:'v3'` a required option.
  Runtime reads: `builder.ts:106` (normalizer selection), `builder.ts:120`
  (nullability default). Under `defaults:'v3'` the option type comes from
  `AddVersionedDefaultsToBuilderOptions<..., 'v3'>` (`index.ts:56-57`,
  `builder-options.ts:30-38`), which layers each plugin's `V3SchemaBuilderOptions`.

Precise phrasing for docs: for these three, "the generic and the option must agree"
is true — but the causality is: **the generic is a type-level declaration, and the
type system requires you to also pass the matching runtime option because the
runtime behavior is driven by the option.** It is NOT that the constructor
auto-derives runtime config from the generic.

### 4.B — Runtime option that *reads* a generic key but is not "forced" by it
The option's type references a generic for shape, but setting the generic does not
make the option required, and vice-versa:
- `tracing.default: Types['Tracing'] | (...)` (`plugin-tracing/global-types.ts:20-24`).
- `subGraphs.defaultForTypes?: Types['SubGraphs'][]` (`plugin-sub-graph/global-types.ts:81-88`);
  `subGraph?: Types['SubGraphs'] | ...` on `BuildSchemaOptions` (`:22-24`).
- `prisma.client: (ctx: Types['Context']) => PrismaClient` reads `Context`
  (`plugin-prisma/global-types.ts:47`), and `smartSubscriptions: SmartSubscriptionOptions<Types['Context']>`
  reads `Context`.
These are ordinary runtime config typed against generics; they are the plugin's own
concern, not a core symmetry.

### 4.C — Generic key with NO constructor counterpart at all (purely type-level)
Setting these changes only what the type-checker accepts/infers; nothing in the
constructor corresponds, and (except when referenced by a field that gets built)
nothing at runtime corresponds either:
- **`Context`, `Root`** — runtime values arrive at *execution* time from the server,
  never from `SchemaBuilder`. (No option; verified §2.)
- **`Objects`, `Interfaces`, `Inputs`** — pure type maps feeding `outputShapes`/
  `inputShapes`. Their runtime counterpart, if any, is a later builder *method* call
  (`builder.objectType('Name', …)`), not a constructor option. F2: this is
  "centralize your type definitions," not ORM wiring.
- **`Scalars`** — [type-level] declaring `Scalars: { DateTime: { Input: Date; Output: Date } }`
  adds the name to `ScalarName<Types>` (`schema-types.ts:75-76`) and its shapes to
  `inputShapes`/`outputShapes`. **There is NO constructor option for scalars and
  nothing forces registration.** The runtime counterpart is a *builder method*:
  `builder.scalarType('DateTime', { serialize, parseValue, … })` (`builder.ts:545-581`)
  or `builder.addScalarType('DateTime', existingGraphQLScalar, …)` (`builder.ts:583-616`).
  Two-halves subtlety: declaring the scalar in the generic but never registering it is
  fine *until a field references it* — at build the unregistered scalar has no
  implementation and `BuildCache` throws `Missing implementation of for type …`
  (`build-cache.ts:478`). The five built-ins (`ID/Int/Float/String/Boolean`) are the
  exception: `toSchema()` auto-registers any of them not already implemented
  (`builder.ts:697-703`). So "the generic requires a runtime serializer" is FALSE in
  general and only becomes true transitively if you actually use the scalar. Docs must
  not imply the constructor takes scalar serializers.
- **`InferredFieldOptionsKind`** — pure inference switch, no option.
- **`DefaultAuthStrategy`, `Connection`, `DefaultEdgesNullability`, `DefaultNodeNullability`,
  `WithInputArgRequired`, `FederationScopes/Policies`, `AuthScopes/AuthContexts`,
  `Directives` (generic), `PrismaTypes`, `DrizzleRelations`** — plugin type-level keys.
  Some pair with a required option in category 4.B (e.g. `PrismaTypes` pairs with the
  required `prisma` option) but the *generic* itself doesn't force the option and the
  option doesn't force the generic; they're wired by the plugin, not by a core rule.

### 4.D — Constructor options with NO generic counterpart
`plugins`, `notStrict`, and every plugin option object (`prisma`, `drizzle`,
`scopeAuth`, `smartSubscriptions`, `relay`, `errors`, `tracing`, `complexity`,
`validation`, `zod`, `withInput`, `directives`, `add`, `subGraphs`). These are pure
runtime/enablement config. (Several are *required* purely by being imported — §3
options — which is the closest thing to a "you must pass config" rule, but it is
driven by which plugin package is loaded, not by the generic.)

**Summary table for docs writers (generic key → constructor relationship):**

| Generic key | Category | Constructor counterpart |
|---|---|---|
| `Defaults` | 4.A forced | `defaults` (required iff non-default) |
| `DefaultFieldNullability` | 4.A forced | `defaultFieldNullability` (required iff non-default) |
| `DefaultInputFieldRequiredness` | 4.A forced | `defaultInputFieldRequiredness` (required iff non-default) |
| `Context`, `Root` | 4.C | none (execution-time value) |
| `Scalars` | 4.C | none (builder method `scalarType`/`addScalarType`, only if used) |
| `Objects`, `Interfaces`, `Inputs` | 4.C | none (builder methods) |
| `InferredFieldOptionsKind` | 4.C | none |
| `PrismaTypes` | 4.C/plugin | required `prisma` option (wired by plugin, not core) |
| `DrizzleRelations` | 4.C/plugin | required `drizzle` option |
| `Tracing` | 4.B | `tracing.default` reads it (optional) |
| `SubGraphs` | 4.B | `subGraphs`/`subGraph` read it (optional) |
| (no generic) | 4.D | `plugins`, `notStrict`, all plugin option objects |

---

## 5. Version normalizers (`defaults: 'v3'`) — how options are rewritten at construction

- `SchemaBuilder.optionNormalizers` is a static `Map` of plugin name → `{ v3?, v4? }`
  normalizer fns (`builder.ts:84-92`), populated by the 3rd arg to `registerPlugin`
  (`builder.ts:130-147`).
- In the constructor (`builder.ts:105-111`) it reduces over all registered
  normalizers: when `options.defaults === 'v3'` and a `v3` normalizer exists, it
  `Object.assign`s the normalizer's output onto the options. This is how v3-mode
  option shapes (e.g. scope-auth's `authScopes`/`scopeAuthOptions` instead of
  `scopeAuth`, `scope-auth/global-types.ts:42-46`) get translated into the v4 option
  shape the plugins consume at runtime. **Runtime effect:** the stored `this.options`
  may differ from what the user literally passed.
- Type side: `V3SchemaBuilderOptions<Types>` interfaces (per plugin) + core's
  `VersionedSchemaBuilderOptions` (`schema-types.ts:49-51`) feed
  `AddVersionedDefaultsToBuilderOptions` (`builder-options.ts:30-38`) so the v3
  constructor signature is a different, plugin-defined shape.

Docs guidance: `defaults: 'v3'` exists for migration from Pothos v3 defaults; new
schemas use `'v4'` (the default when the key is omitted). Behavioral deltas driven by
`defaults`: default scalar shapes (`ID.Output` is `number|string` in v3 vs
`bigint|number|string` in v4, `schema-types.ts:57-71`) and default field nullability
(v3 = non-null by default, v4 = nullable by default, `builder.ts:120` /
`global/schema-types.ts:84-90`).

---

## 6. `toSchema(options?)` — what it does and its options

Runtime: `builder.ts:693-738`. Sequence:
1. Normalize varargs (`NormalizeArgs`, options optional): `const [options = {}] = args` (`:694`).
2. **Auto-register missing built-in scalars.** For `ID, Int, Float, String, Boolean`
   (`:697`), if `configStore.hasImplementation(name)` is false, call
   `addScalarType(name, scalar)` (`:699-703`). This is the ONLY implicit type
   registration `toSchema` performs.
3. Construct `BuildCache(this, options)` (`:705`) — passes the build options through.
4. `buildCache.plugin.beforeBuild()` (`:707`) then `buildCache.buildAll()` (`:709`):
   plugins get a pre-build hook and all Pothos refs are resolved into
   `GraphQLNamedType`s.
5. Resolve the operation root names — uses configured `Query`/`Mutation`/
   `Subscription` names if those roots were defined, else literal defaults
   (`:713-721`).
6. Build a `graphql.GraphQLSchema` (`:723-731`) with `query/mutation/subscription`,
   plus `extensions`, `directives`, `types: builtTypes`, `astNode` from options.
7. `buildCache.plugin.afterBuild(schema)` (`:733`) — plugins may transform the schema
   (e.g. mocks, directives mapping).
8. **Sort:** returns `lexicographicSortSchema(processedSchema)` UNLESS
   `sortSchema === false` (`:735-737`). So **by default the emitted schema is
   lexicographically sorted**; pass `sortSchema: false` to preserve definition order.

`BuildSchemaOptions<Types>` — core keys (`global/schema-types.ts:33-38`):
- **`directives?: readonly GraphQLDirective[]`** — directive definitions to include
  in the schema.
- **`extensions?: Record<string, unknown>`** — schema-level extensions
  (default `{}`, `:727`).
- **`sortSchema?: boolean`** — default-on lexicographic sort (see step 8).
- **`astNode?: SchemaDefinitionNode`** — schema AST node passed through (`:730`).

Plugin-owned `BuildSchemaOptions` (declaration-merged; passed to `toSchema`, not the
constructor):
- **`schemaDirectives?`** — plugin-directives (`global-types.ts:125-127`).
- **`complexity?`** — plugin-complexity (`global-types.ts:21-23`) (build-time
  complexity limits; note complexity appears on BOTH constructor and build options).
- **`disableScopeAuth?: boolean`** — plugin-scope-auth (`global-types.ts:56-58`).
- **`mocks?: ResolverMap<Types>`** — plugin-mocks (`global-types.ts:11-13`), applied
  in `afterBuild`.
- **`subGraph?`** — plugin-sub-graph (`global-types.ts:22-24`): build a filtered
  sub-graph.
- **`customBuildTimeOptions?`** — plugin-example (demo only, `global-types.ts:16-18`).

Naming note for docs: the method is `toSchema()`. There is no `build()` method on
`SchemaBuilder` in this source — verified: `builder.ts:693` is the sole definition
(`toSchema(...args: ...)`), and grep for `build(` in `builder.ts` returns no method
declaration. If migrating readers expect a `build()` call, the correct name is
`toSchema()`. (The previous wording said old docs "historically referenced
`toSchema`," which was a tautology; the intended contrast was `build` → `toSchema`.)

---

## 7. Static surface (not per-instance, but part of "construction")

- `SchemaBuilder.registerPlugin(name, plugin, normalizeOptions?)` — `builder.ts:130-148`.
  Populates the static `plugins` registry; throws on duplicate unless
  `allowPluginReRegistration` (`builder.ts:94, 139-141`). Each plugin package calls
  this at import time — this is why importing a plugin is what makes its options/
  generics appear.
- `SchemaBuilder.plugins` (`builder.ts:82`), `SchemaBuilder.optionNormalizers`
  (`builder.ts:84-92`), `SchemaBuilder.allowPluginReRegistration` (`builder.ts:94`)
  are static.

---

## 8. UNRESOLVED / caveats

- UNRESOLVED (out of territory, flag for another dossier): the exact `implement` vs
  ref-creation option split (ledger F3) and class-backed `instanceof` abstract-type
  resolution (F4) live in the object-types / refs dossier; I confirmed
  `objectType` merges `options.fields` and a separate `fields` thunk
  (`builder.ts:188-198`) but did not fully map the `ImplementableObjectRef.implement`
  option surface here.
- Verified NOT a constructor option (despite plausible expectation): scalar
  serializers, context factory, root value, and per-type backing models — all are
  builder-method- or execution-time concerns, not `SchemaBuilderOptions` keys
  (§4.C, §4.D).
- The `SchemaBuilder` instance's own public type is `PothosSchemaTypes.SchemaBuilder<Types>`
  = `Builder<Types>` (`global/classes.ts:31`); the method set (`objectType`,
  `queryType`, `scalarType`, `toSchema`, …) is on that interface. Enumerating each
  builder method's options is other dossiers' territory; this one covers only
  construction + `toSchema`.
