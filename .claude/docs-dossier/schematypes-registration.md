# Dossier: SchemaTypes type registration (`Objects` / `Interfaces` / `Inputs` / `Scalars` generics)

Territory: what registering a type on the `SchemaTypes` generic actually does; its real
use case (centralizing type definitions — ledger F2); and, established from source, the
*separate* mechanism Prisma/Drizzle use to map type-name strings to ORM models — so docs
never conflate the two.

All paths are relative to repo root. Line numbers are from the worktree at audit time.

---

## 0. Ledger items resolved here

- **F2** — Registering types on the `Objects` / `Interfaces` generics is *not* the mechanism
  Prisma/Drizzle use to wire type-name strings to ORM model names. Resolved in §4–§5 with the
  actual mechanism named: a **separate** generic (`PrismaTypes` for Prisma, `DrizzleRelations`
  for Drizzle), populated from ORM-derived metadata, consumed by ORM-specific builder methods.
- **S2** (define by what things are, not negation-first) applies to how docs frame this: lead
  with "the generic is a compile-time name→shape table," then contrast with the ORM generic.

---

## 1. What the registration generics are, structurally

- `SchemaTypes` is the internal, fully-populated type table. Its `Objects` / `Inputs` /
  `Interfaces` / `Scalars` fields default to `{}` (empty) plus the five built-in scalars.
  `packages/core/src/types/schema-types.ts:3` —
  ```ts
  export interface SchemaTypes extends PothosSchemaTypes.UserSchemaTypes {
    outputShapes: { String: unknown; ID: unknown; Int: unknown; Float: unknown; Boolean: unknown };
    inputShapes: { ... };
    Objects: {};
    Inputs: {};
    Interfaces: {};
    Scalars: { String: { Input: unknown; Output: unknown }; ... };
    ...
  }
  ```
- The *user-facing* shape you fill in is `PothosSchemaTypes.UserSchemaTypes`.
  `packages/core/src/types/global/schema-types.ts:54` —
  ```ts
  export interface UserSchemaTypes {
    Defaults: 'v3' | 'v4';
    Scalars: { [scalar: string]: { Input: unknown; Output: unknown } };
    Objects: {};
    Inputs: {};
    Interfaces: {};
    Root: object;
    Context: object;
    ...
  }
  ```
- The generic you pass to `new SchemaBuilder<Types>()` is normalized into a full `SchemaTypes`
  by `ExtendDefaultTypes<PartialTypes>`. This is where `Objects`/`Interfaces`/`Inputs`/`Scalars`
  become the `outputShapes` / `inputShapes` lookup tables that the rest of the type system reads.
  `packages/core/src/types/global/schema-types.ts:72` —
  ```ts
  export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>>
    extends SchemaTypes {
    Objects: PartialTypes['Objects'] & {};
    Inputs: PartialTypes['Inputs'] & {};
    Interfaces: PartialTypes['Interfaces'] & {};
    ...
    outputShapes: { [K in keyof MergedScalars<PartialTypes>]: ... }
      & { [K in keyof PartialTypes['Objects']]: PartialTypes['Objects'][K] }
      & { [K in keyof PartialTypes['Interfaces']]: PartialTypes['Interfaces'][K] };
    inputShapes: { [K in keyof MergedScalars<PartialTypes>]: ... }
      & { [K in keyof PartialTypes['Inputs']]: RecursivelyNormalizeNullableFields<...> };
  }
  ```
  `packages/core/src/types/global/schema-types.ts:94-113`.

- Load-bearing consequence: `Objects` and `Interfaces` both feed `outputShapes`; `Inputs`
  feeds `inputShapes`; `Scalars` feeds *both* (via `MergedScalars`, split into Input/Output).
  So the four registration generics are just four typed sub-tables that get flattened into two
  master tables keyed by type-name string.

- **Canonical shape of an entry**: `{ TypeName: BackingShape }`. Example from the test suite,
  `packages/core/tests/examples/starwars/builder.ts:5` —
  ```ts
  export interface Types {
    Objects: { Droid: Droid; Human: Human; String: string };
    Interfaces: { Character: Character };
    Context: ContextType;
  }
  ```
  Here the *key* is the GraphQL type name string; the *value* is the backing/parent model type.

---

## 2. What the registration does at the TYPE level (the only level it operates on)

- The single thing registration buys you: a string like `'Human'` becomes usable as a type
  parameter, and Pothos knows its backing shape. Name→shape resolution is
  `OutputShape<Types, T>`, `packages/core/src/types/type-params.ts:14` —
  ```ts
  export type OutputShape<Types extends SchemaTypes, T> = T extends { [outputShapeKey]: infer U }
    ? U
    : T extends new (...args: any[]) => infer U
      ? (U extends { [outputShapeKey]: infer V } ? V : U)
      : T extends keyof Types['outputShapes']       // <-- string lookup
        ? Types['outputShapes'][T]
        : T extends BaseEnum ? ValuesFromEnum<T> : never;
  ```
  The `T extends keyof Types['outputShapes'] ? Types['outputShapes'][T]` branch is exactly the
  string-name path. A registered name resolves to its registered shape; an unregistered string
  falls through to `never`.

- Which strings are even *accepted* as a type param is gated by the same table.
  `OutputType`, `packages/core/src/types/type-params.ts:90` —
  ```ts
  export type OutputType<Types extends SchemaTypes> =
    | BaseEnum | keyof Types['outputShapes'] | (new (...args: any[]) => any) | { [outputShapeKey]: unknown };
  ```
  `InputType` mirrors this with `keyof Types['inputShapes']`, `type-params.ts:102`.

- `ObjectParam` / `InterfaceParam` narrow further: a bare string is only a valid object param
  if it was registered specifically under `Objects` (resp. `Interfaces`), not merely present in
  `outputShapes`. `packages/core/src/types/type-params.ts:118` —
  ```ts
  export type ObjectParam<Types extends SchemaTypes> =
    | Extract<OutputType<Types>, keyof Types['Objects']>
    | ObjectRef<Types, unknown>
    | (new (...args: any[]) => any);
  ```
  `packages/core/src/types/type-params.ts:127` (InterfaceParam) uses `keyof Types['Interfaces']`.
  So `Objects` vs `Interfaces` placement decides *which builder methods* will accept the string.

- Parent shape for resolvers/isTypeOf flows from the same lookup via `ParentShape` →
  `OutputShape`, `packages/core/src/types/type-params.ts:33`. Registering `{ Human: Human }`
  is what makes `t.parent` typed as `Human` inside `builder.objectType('Human', …)`.

- **Runtime footprint: none.** `SchemaTypes` and all four sub-tables live in
  `declare global { namespace PothosSchemaTypes { … } }` and in `.ts` type positions only. The
  builder's runtime generic is phantom — `new SchemaBuilder<Types>({})` erases `Types`; the
  constructor stores only the runtime `options` object. No code reads `Objects`/`Interfaces` at
  runtime (they are `interface` members with no value counterpart). Confirm: `SchemaTypes` has
  no runtime declaration anywhere; it is imported strictly as `import type`
  (e.g. `packages/core/src/builder.ts` imports types only for it).

---

## 3. What registration is NOT — and the runtime pairing it requires

- Registering a name on `Objects` does **not** create the GraphQL type. It does not call any
  builder method, does not add a type ref, does not implement fields. It only teaches the
  type-checker a name→shape association.

- To actually get a type in the schema you must, separately and at runtime, create it under
  the same name. In the starwars example the registration in §1 is paired with runtime creation:
  - `packages/core/tests/examples/starwars/schema/human.ts:4` — `builder.objectType('Human', {…})`
  - `packages/core/tests/examples/starwars/schema/droid.ts:4` — `builder.objectType('Droid', {…})`
  - `packages/core/tests/examples/starwars/schema/character.ts:5` — `builder.interfaceType('Character', {…})`

- Runtime name resolution is a *completely different table* from the type-level one: a runtime
  `Map<string, PothosTypeConfig>` keyed by type name.
  `packages/core/src/config-store.ts:22` — `typeConfigs = new Map<string, PothosTypeConfig>();`
  and `implementors = new Map<string, BaseTypeRef<Types>>()` at `config-store.ts:28`.
  `builder.objectType('Human', …)` builds an `ObjectRef` and registers it here via
  `configStore.addTypeRef(ref)` (`packages/core/src/builder.ts:200`); the name comes from the
  string param (`builder.ts:158-161`).

- If you register a name on the generic but never create it at runtime, the *type* checks pass
  but the *build* throws when something references the name. Resolution of a string output param
  goes through `getOutputTypeRef`, which throws if `typeConfigs` lacks the name.
  `packages/core/src/config-store.ts:283-297` —
  ```ts
  if (typeof resolved === 'string' && this.typeConfigs.has(resolved)) { … }
  throw new PothosSchemaError(`${this.describeRef(param)} has not been implemented`);
  ```
  Unresolved references are also surfaced en masse at build via `prepareForBuild`,
  `packages/core/src/config-store.ts:335-343` ("Missing implementations for some references").
  → **Type-level vs runtime, stated both ways:** the generic makes the *name* legal and *shaped*
  for the compiler; the runtime `objectType`/`interfaceType`/`objectRef` call makes the *type*
  exist. Neither implies the other.

- Nuance worth a doc footnote, not the main text: `outputShapes` is built as a three-way
  **intersection** — `{…Scalars} & {…Objects} & {…Interfaces}`
  (`packages/core/src/types/global/schema-types.ts:94-102`, note the two `&` joining the three
  mapped types). Same-key members therefore combine by TypeScript intersection, **not** override
  or shadow: an `Objects` entry keyed the same as a scalar produces
  `ScalarOutput & ObjectsShape`, retaining both halves, never replacing the scalar shape.
  - The starwars example literally does `Objects: { … String: string }`
    (`packages/core/tests/examples/starwars/builder.ts:6`). Here it is harmless because the
    scalar output shape for `String` is already `string`, so the merge is `string & string = string`.
  - A *differing* shape would surface the intersection. Emulating `Scalars & { String: { foo: number } }`,
    `outputShapes['String']` becomes `string & { foo: number }`: a plain `string`-typed value is
    **not** assignable to it (TS2322), while both `.foo` (number) and string `.length` resolve —
    proving both members are retained, i.e. intersection, not shadowing.
  - Actionable point for docs (correct): the `Scalars` and `Objects` key spaces are **not** disjoint —
    a same-key entry merges rather than errors, and the result may be a non-obvious intersection.
    Docs need not teach this, but should not claim the keys are disjoint namespaces, and should
    not describe it as "shadowing."

---

## 4. The REAL use case per the maintainer (ledger F2): centralizing type definitions

- Ground truth stance (ledger F2, binding): registering on `Objects`/`Interfaces` "is really for
  centralizing your type definitions." What the source supports as the concrete payoff:
  1. You can refer to a type by a **string name** anywhere (`type: 'Human'`, `interfaces:
     ['Character']`) instead of importing and threading an `ObjectRef` value. Seen in
     `packages/core/tests/examples/starwars/schema/query.ts:15,27,32,41` and
     `.../schema/character.ts:17` (`type: ['Character']`).
  2. Backing-model shapes live in one place (the `SchemaTypes` interface) rather than being
     re-declared at each `objectRef<Shape>()` / `implement` site.

- This is a *convenience / organization* mechanism, not a data-layer binding. The string `'Human'`
  carries no knowledge of any ORM model, table, or query; it only carries the TS backing type you
  wrote in the generic and (at runtime) resolves to whatever `objectType('Human', …)` you defined.

- Docs recommendation posture (per S1): present string-registration as *one valid style* among
  objectRef and class-backed types, not as the default and not as second-class. objectRef is the
  docs' common default (S1). Do not frame registration as "reach for it only when…".

---

## 5. What Prisma/Drizzle ACTUALLY use (the separate mechanism) — so docs never conflate

The ORM plugins do **not** use `Objects`/`Interfaces`. Each adds its **own dedicated generic**
via global augmentation of `UserSchemaTypes`, and their model-typed builder methods key off that
generic — never off `Objects`.

### 5a. Prisma → the `PrismaTypes` generic

- Separate generic, added by augmentation. `packages/plugin-prisma/src/global-types.ts:77` —
  ```ts
  export interface UserSchemaTypes { PrismaTypes: {}; }
  export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
    PrismaTypes: PartialTypes['PrismaTypes'] & {};
  }
  ```
  (`global-types.ts:77-83`.) This is a sibling of `Objects`, not a use of it.

- `prismaObject` accepts a **model key from `PrismaTypes`**, not an `Objects` name.
  `packages/plugin-prisma/src/global-types.ts:110` —
  ```ts
  prismaObject: <
    Name extends keyof Types['PrismaTypes'],
    const Interfaces extends InterfaceParam<Types>[],
    Model extends PrismaModelTypes & Types['PrismaTypes'][Name],
    …
  >(name: Name, options: …) => PrismaObjectRef<Types, Model, …>;
  ```
  `prismaInterface`, `prismaObjectField(s)`, `prismaNode` are all keyed on
  `keyof Types['PrismaTypes']` too (`global-types.ts:132,154,170,186`, and
  `schema-builder.ts:114` for `prismaNode`).

- Each `PrismaTypes[Name]` value is not a plain backing shape (contrast §1) — it is a rich
  `PrismaModelTypes` descriptor: `Name`, `Shape`, `Include`, `Select`, `Where`, `OrderBy`,
  `Relations`, etc. `packages/plugin-prisma/src/types.ts:43` (`interface PrismaModelTypes { Name;
  Shape; … }`) and the generated form `PrismaTypesFromClient`,
  `packages/plugin-prisma/src/types.ts:942-955`. This descriptor is what powers typed relations,
  `select`/`include`, and connection args — things a bare `Objects` entry cannot express.

- The `PrismaTypes` map is **code-generated / inferred from the Prisma client**, not hand-written
  as `Objects` entries are. Two supported sources:
  - Generator output: `packages/plugin-prisma/src/generator.ts:439` emits a `PrismaTypes`
    interface (the `pothos` Prisma generator).
  - Client inference: `type PrismaTypes = PrismaTypesFromClient<typeof prisma>`,
    documented at `packages/plugin-prisma/src/types.ts:938-942`.

- **Runtime wiring is separate again** — it is the DMMF/`datamodel`, not the generic:
  - The plugin option carries the client and datamodel:
    `packages/plugin-prisma/src/global-types.ts:44-74`
    (`SchemaBuilderOptions.prisma = { client; dmmf: { datamodel } … }`).
  - `prismaObject(type, …)` resolves the model-name string to a runtime `PrismaObjectRef` that
    stores `modelName`, and stamps the model + relation map + loader into GraphQL type
    extensions. `packages/plugin-prisma/src/schema-builder.ts:24-63`, esp.:
    ```ts
    const ref = … getRefFromModel(type, this) …;   // ref.modelName = model name
    const fieldMap = getRelationMap(getDMMF(this)).get(type)!;
    …
    extensions: { pothosPrismaModel: type, pothosPrismaFieldMap: fieldMap,
                  pothosPrismaLoader: ModelLoader.forRef(ref, type, …) }
    ```
  - `PrismaObjectRef` holds the model name at runtime: `packages/plugin-prisma/src/object-ref.ts:21`
    (`modelName: string;`) and a phantom `[prismaModelKey]` for the descriptor
    (`object-ref.ts:10,17`).
  - Model-name→ref map is a plugin-local `WeakMap`, not the core config store:
    `packages/plugin-prisma/src/util/datamodel.ts:7,18-36` (`getRefFromModel` caches
    `new PrismaObjectRef(name, name)` per builder).

- The GraphQL type name defaults to the model name but is decoupled from it:
  `name = options.variant ?? options.name ?? type` (`schema-builder.ts:31`). So even the
  string identity is model-name-derived only by default; the model binding lives in
  `modelName` + extensions + DMMF, independent of any `Objects` registration.

### 5b. Drizzle → the `DrizzleRelations` generic

- Separate generic, same augmentation pattern.
  `packages/plugin-drizzle/src/global-types.ts:50` —
  ```ts
  export interface UserSchemaTypes { DrizzleRelations: TablesRelationalConfig; }
  export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
    DrizzleRelations: PartialTypes['DrizzleRelations'] & {};
  }
  ```
  (`global-types.ts:50-56`.) `TablesRelationalConfig` is Drizzle's own relational-schema type —
  a table-name→table-config map, not a Pothos `Objects` table.

- `drizzleObject` keys off `keyof Types['DrizzleRelations']` (the table name), not `Objects`.
  `packages/plugin-drizzle/src/global-types.ts:59-67` —
  ```ts
  drizzleObject: <
    …
    Table extends keyof Types['DrizzleRelations'],
    Selection … DBQueryConfig<'one', Types['DrizzleRelations'], Types['DrizzleRelations'][Table]>,
    …
  >
  ```
  `drizzleInterface`, `drizzleObjectField(s)`, `drizzleInterfaceField(s)` all key on
  `keyof Types['DrizzleRelations']` (`global-types.ts:77,110,131,150,170`).

- **Runtime wiring is the Drizzle relations config from the plugin option**, not the generic:
  - `getSchemaConfig` reads `builder.options.drizzle.relations` (or the client's `_.relations`).
    `packages/plugin-drizzle/src/utils/config.ts:13-17` —
    ```ts
    if (builder.options.drizzle.relations) { relations = builder.options.drizzle.relations; }
    else { relations = (builder.options.drizzle.client as DrizzleClient)._.relations; }
    ```
    Option type: `packages/plugin-drizzle/src/types.ts:87-97` (`DrizzlePluginOptions … relations?:
    Types['DrizzleRelations']`).
  - `drizzleObject(table, …)` looks up `getSchemaConfig(this).relations[table]` and stamps it
    into extensions with a loader: `packages/plugin-drizzle/src/schema-builder.ts:25-49`, esp.:
    ```ts
    extensions: { pothosDrizzleModel: table,
                  pothosDrizzleTable: getSchemaConfig(this).relations[table],
                  pothosDrizzleLoader: ModelLoader.forModel(table, this) }
    ```
  - GraphQL type name again defaults to the table name but is decoupled:
    `name = options.variant ?? options.name ?? table` (`schema-builder.ts:26`).

### 5c. The clean contrast docs must draw

| Aspect | `Objects`/`Interfaces` (core) | `PrismaTypes` (Prisma) | `DrizzleRelations` (Drizzle) |
|---|---|---|---|
| Generic key | `Objects` / `Interfaces` on `UserSchemaTypes` | `PrismaTypes` (separate) | `DrizzleRelations` (separate) |
| Source | `core/src/types/global/schema-types.ts:62-64` | `plugin-prisma/src/global-types.ts:77-79` | `plugin-drizzle/src/global-types.ts:50-52` |
| Entry value | a backing/parent TS shape | `PrismaModelTypes` descriptor (Shape+Include+Select+…) | Drizzle `TableRelationalConfig` |
| How populated | hand-written by you | generated / `PrismaTypesFromClient<typeof prisma>` | Drizzle relations schema / client `_.relations` |
| Consumed by | `objectType`/`objectRef`, string params generally | `prismaObject`/`prismaInterface`/`prismaNode`/`prisma*Field(s)` | `drizzleObject`/`drizzleInterface`/`drizzle*Field(s)` |
| Runtime binding to data | **none** — pure name→shape for TS | DMMF `datamodel` + `modelName` + extensions + loader | `options.drizzle.relations`/client + extensions + loader |

- One-line for docs (F2, S2-safe, action-oriented): "Registering a type on `Objects` teaches
  TypeScript a name and its backing shape; it does not connect that name to any database. The
  Prisma and Drizzle plugins bind type names to models through their own separate generics
  (`PrismaTypes`, `DrizzleRelations`) plus runtime ORM metadata — a different mechanism entirely."

---

## 6. Doc-writer traps (things easy to get wrong)

- Do not say "the `Objects` generic is how Prisma maps GraphQL types to models." It is not; that
  is `PrismaTypes` (§5a). This is the F2 violation to avoid.
- Do not imply registering a name creates the type. It does not (§3). Always show the paired
  runtime `objectType`/`interfaceType`/`objectRef(...).implement(...)` call.
- Do not imply the generic has runtime effect. It is erased (§2 last bullet).
- Do not claim `Objects` and `Scalars` keys are disjoint namespaces — a same-key `Objects` entry
  **intersects** with (does not shadow/replace) the scalar's output shape, because `outputShapes`
  is an intersection of the scalar, object, and interface tables
  (`packages/core/src/types/global/schema-types.ts:94-102`, §3 nuance).
- When choosing a first example, pick a natural object type (ledger S3). The existing starwars
  `Human`/`Droid`/`Character` set is a good, honest example of the registration+creation pairing.

---

## 7. UNRESOLVED / not chased (out of this territory, flagged for other dossiers)

- The exact split of object options between ref creation and `implement` (ledger F3) — belongs to
  the object-types / schema-builder dossier. Not established here beyond noting `objectType`
  takes `options` including `fields` (`packages/core/src/builder.ts:150-203`).
- Class-backed types enabling `instanceof` abstract-type resolution (ledger F4) — the
  `new (...args) => any` branches in `ObjectParam`/`InterfaceParam` (`type-params.ts:121-133`) and
  `OutputShape`'s constructor branch (`type-params.ts:18-26`) are the type-level hook, but the
  runtime `instanceof` resolution path (sort-classes / resolveType) was not traced here.
- F1 (constructor-vs-generic relationship) — schema-builder dossier territory; only the narrow
  fact that the generic is phantom at runtime is asserted here (§2).
