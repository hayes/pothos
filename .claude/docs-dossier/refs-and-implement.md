# Dossier: Object / Interface / Input refs and `implement`

Territory: `objectRef` / `interfaceRef` / `inputRef` creation vs `.implement()`; the full
catalog of object type options and the exact option-splitting semantics (ledger **F3**);
one-call forms (`objectRef(...).implement` vs `builder.objectType(ref, ...)`); the class-backed
`isTypeOf`/instanceof affordance at the option level (ledger **F4**, cross-referenced).

All paths are repo-relative to the worktree root. Line numbers are from the state read on
2026-07-06. "Type-level" = what the TS signature admits; "runtime" = what the JS body does.

---

## 1. `objectRef` creation takes ONLY a name — no object options

- `builder.objectRef<T>(name: string)` accepts a single `string` argument and nothing else.
  `packages/core/src/builder.ts:685` — `objectRef<T>(name: string): PothosSchemaTypes.ImplementableObjectRef<Types, T> { return new ImplementableObjectRef<Types, T>(this, name); }`
- The returned `ImplementableObjectRef` constructor also takes only `(builder, name)` — there is
  no config parameter on the implementable ref. `packages/core/src/refs/object.ts:44` —
  `constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string) { super(name); this.builder = builder; }`
- Contrast: the lower-level `ObjectRef` class *can* be constructed with a config
  (`constructor(name: string, config?: ObjectLikeConfig)`, `packages/core/src/refs/object.ts:32`),
  but that path is internal — `builder.objectRef` never passes a config, and there is no public
  builder method that lets a user pass object options at ref-creation time.
- **F3 consequence (source-precise):** the "split" the ledger describes is *name at ref creation,
  every other object option at `implement`*. There are no object options a user sets when calling
  `objectRef` besides the type name. Docs must not imply description/fields/interfaces/etc. can be
  passed to `objectRef`.

- Type shape (single generic): `objectRef<T>` produces `ImplementableObjectRef<Types, T>`, whose
  declaration defaults `Parent = Shape`. `packages/core/src/refs/object.ts:37` —
  `class ImplementableObjectRef<Types, Shape, Parent = Shape>`. So through `objectRef` the parent
  (resolver-input) shape always equals the output shape `T`; there is no `objectRef` parameter to
  make Parent differ from Shape. (A distinct `Parent` only exists on the internal
  `ObjectRef<Types, T, P = T>`, `packages/core/src/refs/object.ts:20`.)

- A freshly created ref has no registered config until it is implemented. Referencing an
  un-implemented ref at build time throws: `packages/core/src/config-store.ts:226` —
  ``throw new PothosSchemaError(`${this.describeRef(ref)} has not been implemented`);`` (also
  `config-store.ts:267,297,337` and `build-cache.ts:478` `Missing implementation of for type ...`).
  Docs recommendation: a ref is a valid type reference immediately (usable in `t.field({ type: ref })`),
  but it must be **implemented** — given a registered *type* config — before `toSchema`, or the build
  errors. The ONLY two calls that register a type config (i.e. that call `ref.updateConfig(...)`) are
  `.implement(...)` (which forwards to `objectType`, §2) and `builder.objectType(ref, ...)` directly
  (`builder.ts:168` `ref.updateConfig({ kind: 'Object', ... })`).
- **`builder.objectFields(ref, ...)` does NOT implement a ref** — corrected from an earlier draft that
  listed it as a config-giving path. `objectFields` (`builder.ts:205-213`) calls
  `configStore.addFields(param, ...)` (`builder.ts:210`), which calls `onTypeConfig`
  (`config-store.ts:48-64`). For a ref whose type config is not yet registered, `onTypeConfig` only
  pushes a callback into `pendingTypeConfigResolutions` (`config-store.ts:110-113`) — it NEVER calls
  `updateConfig`. So a ref that has had only `objectFields`/`objectField` called on it is still
  un-implemented: at build, `prepareForBuild` finds the ref still in `pendingTypeConfigResolutions`
  and throws ``Missing implementations for some references (...)`` (`config-store.ts:335-343`).
  Runtime-vs-order fact: `objectFields`/`objectField` *add fields to a type that is (or will be)
  implemented elsewhere*; they do not themselves supply the type config. Docs must not list
  `objectFields` as a way to implement a ref.

---

## 2. `.implement()` takes the *remaining* object options (F3) — `fields` is just one of them

- `ImplementableObjectRef.implement` accepts `Omit<ObjectTypeOptions<...>, 'name'>` — i.e. the full
  object-type option object minus `name` (name is already fixed by the ref).
  `packages/core/src/refs/object.ts:49-54`:
  ```ts
  implement<const Interfaces extends InterfaceParam<Types>[]>(
    options: Omit<
      ObjectTypeOptions<Types, ImplementableObjectRef<Types, Shape, Parent>, Parent, Interfaces>,
      'name'
    >,
  ): PothosSchemaTypes.ObjectRef<Types, Shape, Parent>
  ```
- `implement` is a thin forwarder to `builder.objectType(this, options)`.
  `packages/core/src/refs/object.ts:55` — `return this.builder.objectType(this, options as ...);`
- **F3, stated precisely for docs:** `implement` is not "where fields go." It receives the object
  type's option bag; `fields` is one key among `description`, `extensions`, `astNode`, `interfaces`,
  `isTypeOf`. The docs correction is to enumerate that bag (below), not to describe `implement` as
  the fields step.
- Return type: `implement` is typed to return a plain `ObjectRef<Types, Shape, Parent>` (no longer
  "implementable"). At runtime it returns whatever `objectType` returns, and `objectType` reuses the
  same ref object when passed a `BaseTypeRef` (see §5), so the returned ref is `===` the original
  implementable ref — only the static type narrows.

---

## 3. Full catalog of object type options (the bag `implement` / `objectType` accept)

Enumerated from the global option interfaces. The runtime `objectType` body reads exactly these keys.

Base options (shared by all named types), `packages/core/src/types/global/type-options.ts:33-37`:
```ts
export interface BaseTypeOptions<Types> {
  description?: string;
  extensions?: Readonly<Record<string, unknown>>;
  astNode?: TypeDefinitionNode;
}
```

Object-specific options, `packages/core/src/types/global/type-options.ts:46-52`:
```ts
export interface ObjectTypeOptions<Types, Shape> extends BaseTypeOptions<Types> {
  fields?: ObjectFieldsShape<Types, Shape>;
  interfaces?: undefined;            // <- note: forced-undefined in this variant (see §4)
  astNode?: ObjectTypeDefinitionNode;
  isTypeOf?: GraphQLIsTypeOfFn<unknown, Types['Context']>;
}
```

So the complete option set for an object type is:

- **`name`** — string. NOT part of `ObjectTypeOptions` itself; injected by the exported wrapper
  type per-param (see §5). Present/optional/required depends on the param form. For `objectRef(...).implement`,
  `name` is `Omit`-ed away entirely (comes from the ref).
- **`description?`** — `string`. `type-options.ts:34`. Runtime: copied to config at `builder.ts:173`.
- **`extensions?`** — `Readonly<Record<string, unknown>>`. `type-options.ts:35`. Runtime: `builder.ts:174`.
- **`astNode?`** — `ObjectTypeDefinitionNode` (narrowed from base `TypeDefinitionNode`).
  `type-options.ts:50`. Runtime: `builder.ts:175`.
- **`fields?`** — `ObjectFieldsShape<Types, Shape>`, i.e. `(t: ObjectFieldBuilder) => FieldMap`.
  `type-options.ts:48`. Optional — an object may be declared with no `fields` at implement time and
  have fields added later (see §6). Runtime: `builder.ts:192-198`.
- **`interfaces?`** — array or thunk of `InterfaceParam`; only present on the *with-interfaces*
  variant (§4). Runtime: `builder.ts:180-182` via `ref.addInterfaces(options.interfaces)`.
- **`isTypeOf?`** — `GraphQLIsTypeOfFn<unknown, Types['Context']>`. `type-options.ts:51`. Runtime:
  `builder.ts:176`, later wrapped by plugins and handed to `GraphQLObjectType` (§7).

Every one of these is accepted by `.implement()` (minus `name`) and by `builder.objectType`'s
`options` argument. There is no additional object option beyond these six-plus-name in core; plugins
augment `PothosSchemaTypes.ObjectTypeOptions` via declaration merging to add their own keys (e.g.
`grantScopes`, `authScopes` from the scopes plugin) — those are out of core's territory but appear on
the same option bag.

Runtime config assembly (authoritative list of what `objectType` extracts),
`packages/core/src/builder.ts:168-178`:
```ts
ref.updateConfig({
  kind: 'Object', graphqlKind: 'Object', name,
  interfaces: [],
  description: options.description,
  extensions: options.extensions,
  astNode: options.astNode,
  isTypeOf: options.isTypeOf,
  pothosOptions: options as PothosSchemaTypes.ObjectTypeOptions,
});
```
Note `interfaces` starts as `[]` and is populated separately (§4); the whole `options` object is
also stashed as `pothosOptions` on the config so plugins can read any extra keys.

---

## 4. The `interfaces` option is split across two type variants — a type-level trick

- The exported option type is a *union* of two interfaces, `packages/core/src/types/builder-options.ts:170-185`:
  ```ts
  export type ObjectTypeOptions<Types, Param, Shape, Interfaces> = Normalize<
    (Param extends string ? {} :
     Param extends ObjectRef<Types, unknown> ? { name?: string } :
     { name: string }) &
    ( PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
    | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces> )
  >;
  ```
- Variant A (`ObjectTypeOptions`, `type-options.ts:46`) sets `interfaces?: undefined` — meaning
  "if you use this variant you cannot pass interfaces."
- Variant B (`ObjectTypeWithInterfaceOptions`, `type-options.ts:54-62`) `Omit`s `interfaces` from A
  and re-adds it as a validated array/thunk:
  ```ts
  interfaces?:
    | (() => Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[])
    | (Interfaces & ValidateInterfaces<Shape, Types, Interfaces[number]>[]);
  ```
- **Type-level behavior:** when you supply `interfaces`, TS selects Variant B and enforces
  `ValidateInterfaces<Shape, ...>` — the object's shape must be assignable to each interface's shape,
  otherwise the interface entry is typed as the error string
  `'Object shape must extend interface shape'` (`packages/core/src/types/builder-options.ts:221-229`).
- **Runtime behavior (both variants identical):** `objectType` never inspects the variant. It always
  initializes `config.interfaces = []` then, if `options.interfaces` is truthy, calls
  `ref.addInterfaces(options.interfaces)` (`builder.ts:180-182`). `addInterfaces` accepts either an
  array or a thunk and defers resolution to build (`packages/core/src/refs/base-with-fields.ts:42-58,
  71-86`). An empty array is a no-op (`base-with-fields.ts:43`).
- `interfaces` may be a **thunk** (`() => [...]`) — this is the escape hatch for
  circular interface/object references. `type-options.ts:59-61`, resolved lazily in
  `base-with-fields.ts:82`.
- Docs recommendation: present `interfaces` as a normal option of `implement`/`objectType`; the
  two-variant machinery is an implementation detail whose only user-visible effect is the shape
  compatibility check and the "must extend" error message.

---

## 5. The `name` option: presence rules depend on the param form (type vs runtime split)

`builder.objectType(param, options, fields?)` — `packages/core/src/builder.ts:150-203`.

Type-level `name` requirement, driven by the conditional in `ObjectTypeOptions`
(`builder-options.ts:176-180`):

| Param form | `name` in options (type-level) | Source |
|---|---|---|
| `string` (inline or a registered `Objects` key) | omitted (`{}`) — name IS the string | `builder-options.ts:176-177` |
| an `ObjectRef` (incl. `ImplementableObjectRef`) | `{ name?: string }` — optional | `builder-options.ts:178-179` |
| a class constructor / other param | `{ name: string }` — **required** | `builder-options.ts:180` |

Runtime name resolution (`builder.ts:158-161`):
```ts
const name = typeof param === 'string'
  ? param
  : ((options as { name?: string }).name ?? (param as { name: string }).name);
```
- **Subtle type-vs-runtime gap:** for a **class** param the runtime would happily fall back to the
  class's `.name` (constructor name) if `options.name` were omitted — but the *type* forces you to
  pass `name` explicitly for a class. So class-backed types read as "name is required" to the user
  even though the runtime could derive it. Document the type behavior (name required for classes);
  do not tell users class name is auto-derived, because the compiler won't let them omit it.
- For an `ObjectRef` param, `name` is optional and, if omitted, comes from `param.name` (the name the
  ref was created with). Passing `name` here would rename — but for `objectRef(...).implement`,
  `name` is `Omit`-ed so this can't happen via `implement`.

`objectType` reuses vs. creates the ref (`builder.ts:163-166`):
```ts
const ref = param instanceof BaseTypeRef
  ? (param as ObjectRef<...>)          // reuse the passed ref
  : new ObjectRef<...>(name);          // create one for string/class params
```
When the param is not a string it also associates the param (class/ref) with the resulting ref so
later lookups resolve (`builder.ts:184-186`, `associateParamWithRef`).

---

## 6. `fields` can be omitted at implement and added later — three imperative APIs

- `fields` is optional on `implement`/`objectType` (`type-options.ts:48`). Both the 3rd positional
  `fields` arg of `objectType` AND `options.fields` are honored, and **both** are added if present —
  they are not mutually exclusive (`builder.ts:188-198`):
  ```ts
  if (fields) { ref.addFields(() => fields(new ObjectFieldBuilder(this))); }
  if (options.fields) { ref.addFields(() => { const t = new ObjectFieldBuilder(this); return options.fields!(t); }); }
  ```
- Add fields to an already-defined object/ref after the fact:
  - `builder.objectFields(param, t => ({...}))` — `packages/core/src/builder.ts:205-213`.
  - `builder.objectField(param, fieldName, t => t.field(...))` — `packages/core/src/builder.ts:215-224`.
  - Low-level `ref.addFields(() => fieldMap)` exists on the ref
    (`packages/core/src/refs/base-with-fields.ts:30-40`) but takes an internal `FieldMap`; the
    builder methods above are the intended public path.
- Interfaces can likewise be added after creation via `ref.addInterfaces(...)`
  (`base-with-fields.ts:42`), used internally by plugins; the user-facing path is the `interfaces`
  option.

---

## 7. `isTypeOf` and the class/instanceof affordance (F4, at the option level)

- `isTypeOf?: GraphQLIsTypeOfFn<unknown, Types['Context']>` is a per-object option
  (`type-options.ts:51`); it is passed through unchanged by `objectType` (`builder.ts:176`).
- At build, core wraps it through the plugin chain and hands it to `GraphQLObjectType`, only for
  `kind === 'Object'` (root types get `undefined`), `packages/core/src/build-cache.ts:564-567`:
  ```ts
  isTypeOf: config.kind === 'Object'
    ? this.plugin.wrapIsTypeOf(config.isTypeOf ?? undefined, config)
    : undefined,
  ```
  `wrapIsTypeOf` default is identity (`packages/core/src/plugins/plugin.ts:156-160`), composed across
  plugins in `packages/core/src/plugins/merge-plugins.ts:134-141`.
- **Core does NOT auto-generate an `instanceof` `isTypeOf` from a class param** (verified: searched
  `builder.ts`, `build-cache.ts`, `config-store.ts` — no `typeof param === 'function'`-driven
  `isTypeOf` synthesis; `objectType` only copies `options.isTypeOf`). The instanceof affordance is
  **user-written**, and class-backed types make it natural because the parent shape is the class
  instance. Canonical example in-repo, `packages/core/tests/examples/giraffes/objects.ts:9` —
  `isTypeOf: (value) => value instanceof Giraffe`.
- How that resolves abstract types: an interface's `resolveType` falls back to graphql's
  `defaultTypeResolver` when no `resolveType` is given — this is the **interface** path only,
  `packages/core/src/build-cache.ts:588` (`const resolver = config.resolveType ?? defaultTypeResolver`).
  (Citation correction from an earlier draft: `:626` is NOT the interface path — it is inside
  `buildUnion` (`build-cache.ts:625-626`, `if (!config.resolveType) return defaultTypeResolver(...)`),
  i.e. the *union* resolver. Unions share the same fallback but it is a separate code path; do not cite
  `:626` for the interface clause.) `defaultTypeResolver` picks the member type whose `isTypeOf` returns
  true, so both interfaces (`:588`) and unions (`:626`) discriminate members via `isTypeOf` when no
  explicit `resolveType` is supplied. So writing
  `isTypeOf: v => v instanceof X` on each class-backed object is exactly what lets an interface/union
  discriminate members. This is the F4 affordance surfaced at the `isTypeOf` option; the deeper
  class-backed-types treatment (backing-model inference, `resolveType` brands) belongs to the
  class-backed dossier — cross-reference it, don't duplicate.
- `ObjectParam` includes class constructors — the type-level basis for class-backed objects,
  `packages/core/src/types/type-params.ts:118-125`:
  ```ts
  export type ObjectParam<Types> =
    | Extract<OutputType<Types>, keyof Types['Objects']>
    | ObjectRef<Types, unknown>
    | (new (...args: any[]) => any);
  ```

---

## 8. Interface refs — same split, plus `resolveType`

- `builder.interfaceRef<T>(name)` — name only, returns `ImplementableInterfaceRef`.
  `packages/core/src/builder.ts:689`; constructor `(builder, name)` at
  `packages/core/src/refs/interface.ts:36`.
- `ImplementableInterfaceRef.implement(options)` forwards to `builder.interfaceType(this, options)`
  and — unlike object `implement` — does **not** `Omit` `name` from the option type; it passes the
  full `InterfaceTypeOptions<...>`. `packages/core/src/refs/interface.ts:41-50`. (Runtime name still
  resolves from the ref via the same `options.name ?? param.name` logic, `builder.ts:394-397`, so
  passing `name` would rename; typically omitted.)
- Interface option catalog, `packages/core/src/types/global/type-options.ts:93-111` — extends
  `BaseTypeOptions` (description/extensions/astNode) plus:
  - `fields?: InterfaceFieldsShape` (`:99`)
  - `interfaces?` array-or-thunk with the same `ValidateInterfaces` check (`:101-103`) — interfaces
    can extend other interfaces.
  - `resolveType?` — `(parent, context, info, type) => MaybePromise<ObjectParam | string | null | undefined>`
    (`:104-110`). This is the interface analogue of object `isTypeOf`. Runtime: copied to config at
    `builder.ts:422` and used at build (`build-cache.ts:588`).
  - No `isTypeOf` (that is object-only).
- Runtime `interfaceType` mirrors `objectType`: reuse-or-create ref (`builder.ts:399-410`),
  `interfaces: []` then `addInterfaces` (`builder.ts:418, 428-430`), fields from 3rd arg and
  `options.fields` both added (`builder.ts:436-442`).
- Exported wrapper `InterfaceTypeOptions` applies the same name conditional as objects — required
  name for class/other param, optional for an `InterfaceRef`, none for a string.
  `packages/core/src/types/builder-options.ts:187-198`.

---

## 9. Input object refs — different option shape (no interfaces, `fields` REQUIRED)

- `builder.inputRef<T, Normalize = true>(name)` — name only, returns `ImplementableInputObjectRef`.
  `packages/core/src/builder.ts:671-683`; constructor `(builder, name)` at
  `packages/core/src/refs/input-object.ts:60`.
- Generic detail: `inputRef` has a `Normalize` type param controlling nullable-field normalization of
  the resolved shape (`RecursivelyNormalizeNullableFields<T>` vs `T`), `builder.ts:671-682`. Not an
  object-option; a shape-inference knob.
- `ImplementableInputObjectRef.implement(options)` forwards to `builder.inputType(this, options)` and
  returns `this` (same ref, typed as `InputObjectRef`). `packages/core/src/refs/input-object.ts:65-77`.
- Input option catalog, `packages/core/src/types/global/type-options.ts:84-91`:
  ```ts
  export interface InputObjectTypeOptions<Types, Fields> extends BaseTypeOptions<Types> {
    isOneOf?: boolean;
    astNode?: InputObjectTypeDefinitionNode;
    fields: (t: InputFieldBuilder<Types, 'InputObject'>) => Fields;   // <- REQUIRED, no `?`
  }
  ```
  - `description?`, `extensions?`, `astNode?` from base.
  - **`fields` is required** (contrast objects/interfaces where it is optional) and uses an
    `InputFieldBuilder`, not the output field builder. Runtime: `builder.ts:664-666` calls
    `options.fields(new InputFieldBuilder(this, 'InputObject'))`.
  - **`isOneOf?: boolean`** — marks a GraphQL `@oneOf` input; also flips the inferred shape to a
    one-of union at the type level (`OneOfInputShapeFromFields`), `builder.ts:625-634, 651`.
  - **No `interfaces`, no `isTypeOf`, no `resolveType`** — inputs have none of these.
- `builder.inputType(param, options)` name resolution is simpler than objects: `name = param string ? param : param.name` (`builder.ts:636`) — there is no `options.name` fallback for inputs.
- **Inputs have no name-conditional wrapper and no class param** (corrected from an earlier draft that
  claimed "the exported name conditional still requires `name` for a class-like param"). Three
  independent source facts:
  1. There is NO exported `InputObjectTypeOptions` wrapper in `builder-options.ts` — `grep -n
     InputObjectTypeOptions packages/core/src/types/builder-options.ts` returns nothing. `inputType`
     uses the global `PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>` directly
     (`builder.ts:628`, `options: PothosSchemaTypes.InputObjectTypeOptions<Types, Fields> & { isOneOf?: IsOneOf }`).
     Objects/interfaces DO have exported name-conditional wrappers (`builder-options.ts:170-198`); inputs
     do not.
  2. `inputType` does not accept a class-like param. Its param is typed
     `Param extends InputObjectRef<Types, unknown> | string` (`builder.ts:619`) — no
     `new (...args) => any` member, unlike `ObjectParam` (§7, `type-params.ts:118-125`). So there is no
     class form for which a `name` could be "required."
  3. The input option interface `InputObjectTypeOptions<Types, Fields>` (`type-options.ts:84-91`) has no
     `name` key at all (`description?`/`extensions?`/`astNode?` from base, plus `isOneOf?` and required
     `fields`). Nothing in the input path "requires `name`."
  Net: for inputs, `name` always comes from the string param or the ref's `.name`
  (`builder.ts:636`); there is no options-level `name`, no class param, and no name conditional.

---

## 10. One-call vs two-call forms — equivalence table

For an object type there are three interchangeable entry points; all end at `objectType`.

- **Two-call, ref-first:** `const R = builder.objectRef<Shape>('Name'); R.implement({ ...options });`
  — `implement` → `objectType(R, options)`. Options carry everything except `name` (fixed by ref).
  `refs/object.ts:49-64`.
- **One-call, ref param:** `builder.objectType(R, { ...options })` where `R` is an existing ref —
  reuses `R` (`builder.ts:164`), `options.name` optional.
- **One-call, string param:** `builder.objectType('Name', { ...options })` — creates the ref,
  name from the string, `options` has no `name` key (type `{}` for the name part).
- **One-call, class param:** `builder.objectType(MyClass, { name: 'Name', ...options })` — name
  required at the type level (§5), backing/parent shape inferred from the class instance type.
- The optional **3rd positional `fields` arg** on `objectType` is an alternative to `options.fields`;
  both are applied if both are present (`builder.ts:188-198`). `.implement` has no positional fields
  arg — fields go inside its single options object.

Same three-way equivalence holds for interfaces (`interfaceRef`/`interfaceType`) and, minus the
class/fields-arg nuances, for inputs (`inputRef`/`inputType`; `inputType` has no 3rd fields arg —
`fields` is a required option).

---

## 11. Where object options are documented today

- UNRESOLVED (docs-content audit, not a source claim): ledger **F3** asserts the object-option split
  is documented "nowhere." I did not exhaustively crawl the `website/` docs pages to re-confirm, so I
  am not independently asserting the negative. What I *can* assert from source is the ground truth the
  docs must state: (a) `objectRef` takes only a name; (b) `.implement`/`objectType` take the six-key
  option bag in §3; (c) `fields` is one optional key, not the purpose of `implement`. Docs
  recommendation (per F3): add a table like §3 and an explicit "what goes where" statement.
- Ledger **S1** (binding editorial): objectRef, class-backed, and SchemaTypes-registered styles are
  all first-class. This dossier deliberately documents `objectType(class, ...)` and `objectRef(...)`
  as peer entry points (§10), not as primary/fallback.

---

## Cross-references (other dossiers)

- Class-backed types in depth (backing-model inference, `resolveType` brands, `instanceof` for
  unions): class-backed dossier. §7 here only covers the `isTypeOf` option surface.
- `SchemaTypes`-registered `Objects`/`Interfaces` generics and how names map: schema-builder /
  schema-types dossier (ledger **F2** territory). §5's "registered `Objects` key" string param
  touches it but does not own it.
- Field builder / `ObjectFieldsShape` internals: field-builder dossier. §3/§6 reference `fields`
  as an option only.
