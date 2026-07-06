# Dossier: Backing models & shapes

Territory: how the parent (backing) type of a resolver is computed from a
ref/generic; how field return types map to TS types (lists, nullability); how
`Context` flows; `DefaultFieldNullability` mechanics (type-level AND runtime).

This is the source-of-truth for the fundamentals pages' central claim that
"types flow from your data." That claim is TRUE and mechanized precisely by the
`OutputShape`/`ParentShape`/`ShapeFromTypeParam` type functions plus the two
shape-carrying symbol keys on every ref. Everything below is traced to source.

Package root for all citations: `packages/core/src/`.

---

## 0. The one-sentence mechanism (what "types flow from your data" actually is)

- Every output ref is a phantom-typed carrier of TWO TS types: an **output
  shape** and a **parent shape**, stored under symbol keys that exist only at
  the type level. `outputShapeKey`/`parentShapeKey` are declared as
  `Symbol.for(...)` and assigned with definite-assignment (`!`) on the class,
  so they have NO runtime value — they are pure type channels.
  - `types/type-params.ts:6-7` — `export const outputShapeKey = Symbol.for('Pothos.outputShapeKey'); export const parentShapeKey = Symbol.for('Pothos.parentShapeKey');`
  - `refs/object.ts:28-30` — `[outputShapeKey]!: T; [parentShapeKey]!: P;` (definite-assignment, never assigned at runtime).
- When you write a field, Pothos reads the parent ref's **parent shape** to type
  the `parent` argument of your resolver, and reads the field's **type param**
  to compute the field's return TS type. Both are derived from the data types
  you handed the ref/generic — nothing is registered redundantly.
  - Resolver `parent` position: `types/builder-options.ts:44-51` `Resolver<Parent, Args, Context, Type, Return>`; `Parent` is fed from `ParentShape<Types, Param>` at field-builder construction (see §4).
  - Field return position: `types/global/field-options.ts:41-47` — `resolve: Resolver<ResolveShape, ..., ShapeFromTypeParam<Types, Type, Nullable>, ...>`.

---

## 1. `OutputShape<Types, T>` — how a ref/generic/class/name resolves to a TS type

`types/type-params.ts:14-31`. Five ordered branches (first match wins):

- **Branch 1 — object carrying `outputShapeKey`** (any ref: ObjectRef,
  InterfaceRef, UnionRef, ScalarRef, EnumRef, OutputRef): the stored `U` is the
  shape. `T extends { [outputShapeKey]: infer U } ? U`. `type-params.ts:14-17`.
- **Branch 2 — a class/constructor** `new (...args: any[]) => infer U`: the
  shape is the **instance type** `U`. Nested guard: if that instance itself
  carries an `outputShapeKey` (`V`), use `V`; else use the instance type `U`.
  `type-params.ts:18-26`. This is the class-backed path: `builder.objectType(MyClass, …)` yields a parent shape of `InstanceType<typeof MyClass>`.
- **Branch 3 — a registered type name** `T extends keyof Types['outputShapes']`:
  look up `Types['outputShapes'][T]`. `type-params.ts:27-28`. This covers
  built-in scalar names (`'String'` → the scalar's Output type) and names
  registered via the `Objects`/`Interfaces` builder generics (see §9).
- **Branch 4 — a TS enum object** `T extends BaseEnum`: shape is
  `ValuesFromEnum<T>` = `T[keyof T]`. `type-params.ts:29-30`, `:140`.
- **Branch 5 — fallthrough**: `never`. `type-params.ts:31`.

Load-bearing detail: **the ref branch is checked BEFORE the class branch**, so a
ref whose shape happens to be a constructor still resolves via its
`outputShapeKey`, not by being treated as a class.

## 2. `ParentShape<Types, T>` — the backing model for resolvers

- `types/type-params.ts:33-37`: `ParentShape<Types, T> = T extends { [parentShapeKey]: infer U } ? U : OutputShape<Types, T>`.
- Meaning: a ref may carry a **distinct parent shape** (`P`) separate from its
  output shape (`T`). If it does, `ParentShape` returns `P`. Otherwise it falls
  back to `OutputShape` (the two coincide). `refs/object.ts:20` — `class ObjectRef<Types, T, P = T>` — **P defaults to T**, so for a plain ref the parent shape equals the output shape.
- Why two shapes exist: plugins (Prisma/Drizzle) and `builder.objectRef<T>()`
  can set `P !== T` so that a resolver receives a richer runtime row than the
  GraphQL-exposed output type. `refs/object.ts:37-41` — `ImplementableObjectRef<Types, Shape, Parent = Shape>` threads a separate `Parent`.
- **Type-level vs runtime**: `ParentShape` is purely a compile-time projection.
  At runtime the "parent" is whatever value your resolver returned / your root
  resolver produced; Pothos performs no coercion of the parent object. The type
  is a promise the resolver author must keep.

## 3. `ShapeFromTypeParam<Types, Param, Nullable>` — field return TS type

`types/type-params.ts:156-168`. This maps a field's `type:` option + `nullable:`
option to the TS type the resolver must return.

- **List dispatch**: `Param extends [OutputType<Types>] ? ShapeFromListTypeParam<…>` — a one-element tuple `[T]` signals a GraphQL list. `type-params.ts:160-161`.
- **Non-list, branch A** `FieldNullability<Param> extends Nullable`: this is the
  "Nullable was left as the wide `boolean` union" case (user did not narrow
  it). Falls back to the schema default:
  `Types['DefaultFieldNullability'] extends true ? OutputShape | null | undefined : OutputShape`. `type-params.ts:162-165`.
- **Non-list, branch B** `Nullable extends true`: `OutputShape | null | undefined`. `type-params.ts:166-167`.
- **Non-list, else**: `OutputShape` (non-null). `type-params.ts:168`.
- Key nuance: `| null | undefined` (not just `| null`) — a nullable field's
  resolver may return either. `type-params.ts:164,167`.

### 3a. `ShapeFromListTypeParam` — lists and granular list/item nullability

`types/type-params.ts:170-196`.

- Simple boolean `Nullable`: `readonly OutputShape<Types, Param[0]>[]` (non-null
  list of non-null items), optionally `| null | undefined` when nullable.
  `type-params.ts:175-182`. Note the list element type is **`readonly` array**.
- Granular object `Nullable extends { list: infer List; items: infer Items }`:
  the list wrapper nullability (`List`) and the item nullability (`Items`) are
  independent. `List extends true` adds `| null | undefined` to the array;
  `Items extends false ? false : true` controls per-item nullability recursively
  via `ShapeFromTypeParam<Types, Param[0], …>`. `type-params.ts:183-196`.
- `FieldNullability<Param>` for a list param is
  `boolean | { items: boolean; list: boolean }`. `type-params.ts:198-207`.

### 3b. `ShapeWithNullability` (sibling helper)

- `types/type-params.ts:144-154`: same nullability semantics factored out —
  `boolean extends Nullable ? (DefaultFieldNullability ? Shape|null|undefined : Shape) : Nullable extends true ? Shape|null|undefined : Shape`. Used by
  plugins that need to apply nullability to an already-computed `Shape` without
  going through a type param.

## 4. How the parent shape reaches the field builder (runtime + type)

- `builder.objectType` constructs the field builder with the computed parent
  shape as its generic: `builder.ts:189,194` — `new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(this)`. Same for `objectFields`/`objectField` (`builder.ts:211,222`).
- `ObjectFieldBuilder<Types, ParentShape>` just forwards to
  `FieldBuilder<Types, ParentShape, 'Object'>`: `fieldUtils/object.ts:4-12`.
- The field-builder's `ParentShape` generic becomes the `parent` type of every
  resolver on that type via the `Resolve` inferred option:
  `types/global/field-options.ts:33-48` (`ResolveShape` slot) and
  `types/global/field-options.ts:79-94` — `ObjectFieldOptions` passes
  `ParentShape` into both the `ParentShape` and `ResolveShape` slots of
  `FieldOptions`.
- **Root types** (`Query`/`Mutation`) use `Types['Root']` as the parent shape,
  not an object shape: `field-options.ts:96-126` (`QueryFieldOptions` /
  `MutationFieldOptions` fix both slots to `Types['Root']`). `Root` defaults to
  `object`: `types/schema-types.ts:31`, `types/global/schema-types.ts:64`.
- **Subscription** splits parent (`Types['Root']`) from the `ResolveShape` the
  `subscribe` iterator yields: `field-options.ts:145-174`.

## 5. `Context` flow

- `Context` is a single entry on `SchemaTypes`, defaulting to `object`:
  `types/schema-types.ts:32` (`Context: object`), and in the user-facing
  registration surface `types/global/schema-types.ts:65` (`Context: object`).
- User `Context` is merged in via `ExtendDefaultTypes`:
  `types/global/schema-types.ts:80` — `Context: PartialTypes['Context'] & {}`.
  (Whatever you put on the builder's `Context` generic is the context type,
  intersected with `{}` — a no-op that keeps it an object.)
- Every resolver receives `context: Types['Context']` as the 3rd argument:
  `types/builder-options.ts:44-48` (`Resolver<Parent, Args, Context, …>` where
  the field-options wiring passes `Types['Context']`), and concretely at
  `types/global/field-options.ts:41-47` — `Resolver<…, Types['Context'], …>`.
- `Context` also threads into `isTypeOf`/`resolveType`/`subscribe`/`extensions`:
  `types/global/type-options.ts:51` (`isTypeOf?: GraphQLIsTypeOfFn<unknown, Types['Context']>`), `:104-110` (interface `resolveType` gets `context: Types['Context']`), `:120-126` (union), `types/global/field-options.ts:71-75` (field `extensions` carries `Types['Context']`).
- **Runtime**: Pothos does not construct context — it is supplied per-request by
  the GraphQL server and passed straight through graphql-js to resolvers. There
  is no context factory in core. (No context-construction code exists in
  `builder.ts`; context is only ever a type parameter.)

## 6. `DefaultFieldNullability` — the v3/v4 default flip (BOTH halves)

This is the single most consequential fact for the fundamentals pages: **in v4,
fields are NULLABLE by default; in v3 they were NON-NULL by default.** Documented
in both the type layer and the runtime layer, which must agree.

### 6a. Type level

- `DefaultFieldNullability` is a `boolean` slot on `SchemaTypes`:
  `types/schema-types.ts:28`.
- Computed by `ExtendDefaultTypes` from the chosen defaults version:
  `types/global/schema-types.ts:84-90`:
  - v3: `PartialTypes['DefaultFieldNullability'] extends true ? true : false` — **false unless explicitly opted into `true`.**
  - v4 (else): `PartialTypes['DefaultFieldNullability'] extends false ? false : true` — **true unless explicitly opted into `false`.**
- The builder OPTION is gated so you can only set the non-default value:
  `types/global/schema-types.ts:11-17` — for v3 the option type is
  `false extends DefaultFieldNullability ? never : DefaultFieldNullability`
  (so v3 can only pass `true`); for v4
  `true extends DefaultFieldNullability ? never : DefaultFieldNullability`
  (so v4 can only pass `false`). Passing the value that already IS the default
  makes the option `never` (a type error).
- Consumed in `ShapeFromTypeParam` branch A / `ShapeFromListTypeParam` /
  `ShapeWithNullability` (§3): when `Nullable` is the wide `boolean` union the
  shape gains `| null | undefined` iff `DefaultFieldNullability extends true`.
  `type-params.ts:163,176,149`.
- Field-builder methods default their `Nullable` generic to
  `Types['DefaultFieldNullability']`: e.g. `fieldUtils/root.ts:392` (`field`),
  `:31` (`boolean`), `:175` (`string`), `:211,247,319,355` (list variants).
  - **Asymmetry to be aware of (harmless):** `float`/`id`/`int` (and their list
    forms `idList`) do NOT set the `= Types['DefaultFieldNullability']` default
    on `Nullable` — `fieldUtils/root.ts:65,101,137,281`. When `nullable` is
    omitted, `Nullable` is then inferred as the wide `FieldNullability` (=`boolean`),
    which routes through `ShapeFromTypeParam` branch A and ALSO consults
    `DefaultFieldNullability`. Net type is identical to the methods that do set
    the default. Docs should treat all scalar field methods as honoring the
    schema default uniformly; the source asymmetry does not produce a behavior
    difference.

### 6b. Runtime

- The builder computes a runtime `defaultFieldNullability: boolean`:
  `builder.ts:100`, set in the constructor at `builder.ts:115-120`:
  `this.defaultFieldNullability = options.defaultFieldNullability ?? options.defaults !== 'v3';`
  — i.e. **v4 (defaults !== 'v3') → `true`; v3 → `false`**, unless overridden.
  This matches the type-level rule exactly.
- Applied when building each field's wrapped type:
  `fieldUtils/base.ts:70-74` — `type: typeFromParam(options.type, this.builder.configStore, options.nullable ?? this.builder.defaultFieldNullability)`.
  So an omitted `nullable` option falls back to the runtime default at schema
  build time.
- `typeFromParam` converts the nullability option into GraphQL NonNull wrapping:
  `utils/params.ts:28-65`. For a list param it splits `{ list, items }`
  (`:33-34`) into outer-list nullability and inner-item nullability; a plain
  boolean sets `nullable` on the leaf (`:34`, `:60`).
- **Both halves must be stated together in docs**: the TS type you must return
  (§3) and the GraphQL nullability printed in the SDL are driven by the same
  `nullable ?? default` decision, so they never diverge.

## 7. `DefaultInputFieldRequiredness` (parallel mechanism, input side)

Adjacent to the territory; include for symmetry since docs pair them.

- Type slot `types/schema-types.ts:29`; computed `types/global/schema-types.ts:91-93` — `PartialTypes['DefaultInputFieldRequiredness'] extends true ? true : false` (**default false** in both v3 and v4).
- `InputShapeFromTypeParam` mirrors `ShapeFromTypeParam` for requiredness:
  `type-params.ts:209-221`; list form `:223-247`.
- Runtime default `builder.ts:122-127` — `?? false`. Applied via
  `inputTypeFromParam` `utils/params.ts:77-120` (note inner-item default is
  `true` at `:82`).

## 8. Resolver return shape & list coercion (runtime-relevant type)

- `Resolver<Parent, Args, Context, Type, Return>`: `types/builder-options.ts:44-51`.
  When `Type` is a list (`[Type] extends [readonly (infer Item)[] | null | undefined]`)
  the return is `ListResolveValue`, else `MaybePromise<Type>`.
- `ListResolveValue` (`:53-64`) permits a resolver to return an array, an
  `Iterable`, or an `AsyncIterable` of items — each item itself `MaybePromise`.
  This is why list resolvers may return `Promise<T>[]`, `T[]`, generators, or
  async generators. Nullability of the array vs items is preserved through
  `ArrayResolverResult`/`IterableResolverResult`/`AsyncIterableResolverResult`
  (`:66-80`).
- **Type vs runtime**: the union of allowed return containers is a type-level
  affordance; at runtime graphql-js awaits promises and iterates iterables. Core
  adds no list-specific coercion beyond what graphql-js does.

## 9. The three backing-model styles (ledger S1, F2, F4 — binding)

All three are first-class and valid (ledger **S1**: none is "older" or
second-class; do not write "reach for them only when…").

### 9a. objectRef style (the docs' common default)

- `builder.objectRef<T>(name)` → `ImplementableObjectRef<Types, T>`:
  `builder.ts:685-687`. Because `ImplementableObjectRef<Types, Shape, Parent = Shape>`
  (`refs/object.ts:37-41`) defaults `Parent = Shape`, both output and parent
  shape are `T` until a plugin overrides `Parent`.
- The `<T>` generic you pass IS the backing model — this is the most direct
  "types flow from your data" path: you state the TS type once, and both the
  resolver `parent` and any `t.expose*` field keys are checked against it.

### 9b. Class-backed style

- Passing a class to `builder.objectType(MyClass, …)` resolves the parent shape
  to `InstanceType<MyClass>` via `OutputShape` branch 2 (§1,
  `type-params.ts:18-26`). `ObjectParam` explicitly admits a constructor:
  `type-params.ts:118-125` (`| (new (...args: any[]) => any)`).
- Ledger **F4** (binding): classes are NOT merely a way to infer the backing
  model — **the class is a runtime value you can `instanceof` against**, which
  makes it a first-class tool for resolving abstract types
  (interfaces/unions). Source proof:
  - Manual pattern in core tests: `packages/core/tests/examples/giraffes/objects.ts:6-9` — `builder.objectType(Giraffe, { … isTypeOf: (value) => value instanceof Giraffe })`. Same at `:19-22` (string param + class shape) and `:38-41` (objectRef + class shape). An `objectRef`/name alone has no runtime constructor to `instanceof`; a class does.
  - Automatic in the dataloader plugin: `packages/plugin-dataloader/src/schema-builder.ts:207-216` — when the ref is created from a class (`typeof nameOrRef === 'function'`), `isTypeOf` defaults to `maybeNode instanceof nameOrRef`. This is the affordance made automatic.
  - **Core does NOT auto-derive `isTypeOf` from a class.** `builder.objectType`
    only passes through `options.isTypeOf` (`builder.ts:176`), and
    `build-cache.ts:564-567` only wraps `config.isTypeOf ?? undefined`. So in
    plain core you write the `instanceof` check yourself; the class is what
    makes writing it possible. (Docs: present this as the payoff of classes, per
    F4 — not as automatic magic in core.)
- Abstract-type resolution order at runtime (interfaces): type-brand → explicit
  `resolveType` → graphql `defaultTypeResolver` (which calls each object type's
  `isTypeOf`). `build-cache.ts:577-591`. Unions: same, brand-first then
  `resolveType`/default. `build-cache.ts:608-627`. A class-backed `isTypeOf` is
  what the default resolver falls through to.

### 9c. SchemaTypes-registered ("builder generics") style

- Ledger **F2** (binding): registering names on the `Objects`/`Interfaces`
  generics is for **centralizing your type definitions** — it is NOT the
  mechanism Prisma/Drizzle use to map GraphQL type names to ORM model names
  (that is a separate plugin mechanism, out of this dossier's territory).
- Source of the mechanism: names on `Objects`/`Interfaces` are folded into
  `Types['outputShapes']` by `ExtendDefaultTypes`:
  `types/global/schema-types.ts:94-102` — `outputShapes` is
  `{ …scalars… } & { [K in keyof PartialTypes['Objects']]: PartialTypes['Objects'][K] } & { [K in keyof PartialTypes['Interfaces']]: … }`.
  A string type name then resolves through `OutputShape` branch 3
  (`type-params.ts:27-28`, `T extends keyof Types['outputShapes']`).
- `ObjectParam` admits such registered names:
  `type-params.ts:118-119` — `Extract<OutputType<Types>, keyof Types['Objects']>`.
  Interfaces likewise `:127-129`.
- So the "data" for a registered name flows from the `Objects`/`Interfaces`
  entry you declared once — the same "types flow from your data" story, just
  keyed by name instead of by ref/generic/class.

## 10. `implement` and the object-option split (ledger F3 — binding)

- Ledger **F3**: `implement` is NOT "where fields go." It takes the **remaining
  options** for an object type (of which `fields` is one). Object options are
  split between **ref creation** and **`implement`** — docs must state the split.
- Source of the split:
  - `builder.objectRef<T>(name)` takes ONLY the name at creation:
    `builder.ts:685-687`. No fields, no interfaces, no description here.
  - `ImplementableObjectRef.implement(options)` takes everything except `name`:
    `refs/object.ts:49-64` — `implement<Interfaces>(options: Omit<ObjectTypeOptions<…>, 'name'>)` and forwards to `builder.objectType(this, options)`.
  - Compare the all-at-once form `builder.objectType(param, options, fields?)`:
    `builder.ts:150-154`. Here `param` carries the name/ref/class and `options`
    carries `fields`/`interfaces`/`description`/`isTypeOf`.
- `fields` is one key among the object options, not a separate concept:
  `types/global/type-options.ts:46-52` — `ObjectTypeOptions.fields?: ObjectFieldsShape<Types, Shape>` sits alongside `description`, `extensions`, `isTypeOf`, `astNode`. Interfaces live on a sibling options type
  `ObjectTypeWithInterfaceOptions` (`:54-62`), unioned in at
  `types/builder-options.ts:180-185`.

## 11. `t.expose*` — exposing a backing-model property as a field

- Generated `exposeString`/`exposeInt`/… and the generic `expose` constrain the
  property name to keys of the parent shape whose value is assignable to the
  field type: `fieldUtils/builder.ts:24-51` (`exposeBoolean`), `:374-413`
  (`expose`). Constraint is `CompatibleTypes`:
  `types/builder-options.ts:284-298` — `{ [K in keyof ParentShape]-?: Awaited<ParentShape[K]> extends ShapeFromTypeParam<Types, Type, Nullable> ? K : never }[keyof ParentShape] & string`. Note `Awaited<…>` — a property typed as a Promise is exposable.
- Nullability of an exposed field is derived from the property's own
  nullability: `ExposeNullability` `types/builder-options.ts:300-333` — if the
  parent property is already non-null-assignable to the field shape, `nullable`
  is optional; otherwise `nullable` is REQUIRED (you must declare it). For lists
  it separates `items`/`list` nullability from the property's array shape
  (`:315-333`).
- Runtime: `exposeField` installs a `defaultFieldResolver`-style getter
  `(parent) => parent[name]` and marks the field so core swaps in graphql-js's
  `defaultFieldResolver`: `fieldUtils/base.ts:93-112`, and the swap at
  `:59-61` (`if (options.extensions?.pothosExposedField === name) resolve = defaultFieldResolver`).
- **This is the concrete embodiment of "types flow from your data":** `expose`
  is compile-time-checked against the parent shape, so you cannot expose a
  property that doesn't exist or whose type doesn't match the GraphQL field.

## 12. `AbstractReturnShape` — interface/union output shapes (adjacent)

- `types/type-params.ts:39-49`: when no `ResolveType` is supplied, an interface
  ref may carry a distinct `abstractReturnShapeKey` shape; otherwise falls back
  to `OutputShape`. Used so `interfaceType` can widen the returnable shape when
  a custom `resolveType` narrows implementers.
- `interfaceType` returns `InterfaceRef<Types, AbstractReturnShape<Types, Param, ResolveType>, ParentShape<Types, Param>>`: `builder.ts:386-390`. Note the
  interface ref, like objects, carries output shape ≠ parent shape.

---

## Docs-recommendation stances grounded here (not raw code behavior)

- **REC (from ledger S1):** present objectRef as the common default the docs
  build examples on, WITHOUT demoting class-backed or SchemaTypes-registered
  styles. All three resolve through the same `OutputShape`/`ParentShape`
  machinery (§1-2, §9) — they are interchangeable entry points, not a hierarchy.
- **REC (from ledger F3):** whenever docs show `objectRef` + `.implement`, they
  must name the split: identity/name at ref creation, everything else in
  `implement` (§10).
- **REC (from ledger F4):** when introducing classes, lead with the two payoffs
  together — backing-model inference AND `instanceof`-based abstract resolution
  (§9b) — not inference alone.
- **REC (from ledger F2):** when docs mention registering types on
  `Objects`/`Interfaces`, frame it as centralizing definitions (§9c), and do NOT
  imply it is how ORM plugins wire model names.

---

## UNRESOLVED

- **UNRESOLVED: exact inference behavior of `float`/`id`/`int` when `nullable`
  is omitted under a v4 builder.** I established from source that these methods
  lack the `= Types['DefaultFieldNullability']` generic default
  (`fieldUtils/root.ts:65,101,137`) and argued the wide-`boolean` inference
  routes through `ShapeFromTypeParam` branch A to the same result
  (`type-params.ts:162-165`). I did NOT compile a live example to confirm TS
  actually infers `Nullable = boolean` (vs `unknown`/the concrete default) in
  practice. Checked: method signatures, `ShapeFromTypeParam`, `FieldNullability`.
  Runtime nullability is unaffected regardless (§6b, `base.ts:73`).
- **UNRESOLVED: whether any core path auto-derives `isTypeOf` from a class.** I
  confirmed core does NOT (`builder.ts:176`, `build-cache.ts:564-567`) and that
  the dataloader plugin DOES (`plugin-dataloader/src/schema-builder.ts:207-216`).
  I did not exhaustively audit every plugin (relay `add-node-props.ts:53-54` and
  scope-auth `is-type-of-helper.ts` also touch `isTypeOf`) for additional
  class-derivation; those are out of territory but flagged so a docs writer
  doesn't over-generalize the core claim.
