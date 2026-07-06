# Dossier: Class-backed object & interface types

Territory: `builder.objectType(SomeClass, …)` / `builder.interfaceType(SomeClass, …)`
semantics — how the backing model is inferred from a class; the `isTypeOf` /
`resolveType` + `instanceof` affordance for abstract types (ledger **F4**); interop
with objectRef and SchemaTypes-registered styles; and the maintainer stance (**S1**)
that governs how docs may frame class-backed types.

All paths are relative to the worktree root
(`…/pg-audit/`). Citations are `packages/<pkg>/src/<file>:<line>` unless noted as a
test/example path.

---

## 0. Terminology (as used in this dossier)

- **Class-backed type** = an object or interface type created by passing a TypeScript
  **class constructor** as the first argument to `builder.objectType` /
  `builder.interfaceType` (as opposed to a **string** registered on the `SchemaTypes`
  generic, or an **objectRef/interfaceRef**). All three are first-class param forms —
  see §1.
- **Backing model** = the TypeScript shape a resolver returns and that Pothos hands back
  as `parent` to fields on the type. For a class-backed type this is the class's
  **instance type** (§2).

---

## 1. A class is one of the three accepted param forms (not a special case)

- `ObjectParam` is a union of exactly three things: a `SchemaTypes['Objects']` key
  (string), an `ObjectRef`, or **any constructor**.
  `packages/core/src/types/type-params.ts:118`
  ```ts
  export type ObjectParam<Types extends SchemaTypes> =
    | Extract<OutputType<Types>, keyof Types['Objects']>
    | ObjectRef<Types, unknown>
    | (new (...args: any[]) => any);
  ```
- `InterfaceParam` is the parallel union; the constructor arm returns `unknown`.
  `packages/core/src/types/type-params.ts:127`
  ```ts
  export type InterfaceParam<Types extends SchemaTypes> =
    | Extract<OutputType<Types>, keyof Types['Interfaces']>
    | InterfaceRef<Types, unknown>
    | (new (...args: any[]) => unknown);
  ```
- The class arm is matched **structurally** by the `new (...args) => any` signature. A
  class does **not** need to be registered on the `Objects`/`Interfaces` generic to be
  used class-backed. Evidence: the docs' own class example builds with `new
  SchemaBuilder({})` (no generic entries) and still passes the class:
  `website/playground-examples/fundamentals-objects/variant-classes/schema.ts:21`
  (`const builder = new SchemaBuilder({});`) and `:26` (`builder.objectType(Race, …)`).
- `OutputType` — the general set of things usable as a field `type` — also includes the
  bare constructor arm, so a class can be used directly as a field type, not only as a
  type-definition param. `packages/core/src/types/type-params.ts:90`
  ```ts
  export type OutputType<Types extends SchemaTypes> =
    | BaseEnum
    | keyof Types['outputShapes']
    | (new (...args: any[]) => any)
    | { [outputShapeKey]: unknown };
  ```
- **Docs stance (S1):** present objectRef as the common default the docs *use*, but
  never describe class-backed (or SchemaTypes-registered) as "older", "legacy", or a
  fallback. The source treats all three as equal arms of one union. The maintainer's
  words: classes are "great when you already have classes representing your data."
  (ledger S1). Do not write "reach for them only when…".

---

## 2. Backing-model inference from a class (TYPE-LEVEL)

The backing model of a class-backed type is the class's **instance type**, computed by
`OutputShape` / `ParentShape`.

- `OutputShape` special-cases a constructor: it infers the instance type `U` from
  `new (...args) => infer U`. If that instance itself carries an `outputShapeKey` brand
  it unwraps to the branded shape, otherwise the instance type `U` is the output shape.
  `packages/core/src/types/type-params.ts:14`
  ```ts
  export type OutputShape<Types extends SchemaTypes, T> = T extends { [outputShapeKey]: infer U }
    ? U
    : T extends new (...args: any[]) => infer U
      ? U extends { [outputShapeKey]: infer V } ? V : U
      : T extends keyof Types['outputShapes'] ? Types['outputShapes'][T] : …;
  ```
  So for `class Giraffe {…}`, `OutputShape<Types, typeof Giraffe>` = `Giraffe` (the
  instance type).
- `ParentShape` only diverges from `OutputShape` when the param carries an explicit
  `parentShapeKey` brand; a plain class constructor does not, so
  `ParentShape === OutputShape === instance type` for class-backed types.
  `packages/core/src/types/type-params.ts:33`
  ```ts
  export type ParentShape<Types extends SchemaTypes, T> =
    T extends { [parentShapeKey]: infer U } ? U : OutputShape<Types, T>;
  ```
- Consequence documented plainly: with a class-backed type, `parent` inside every field
  resolver is an **instance of the class** — you get its methods/getters, not just its
  data. This is the concrete payoff behind "great when you already have classes"
  (S1). Contrast: an `objectRef<IRace>` gives you the interface shape `IRace` as
  `parent`; a class gives you a live instance.
- `objectType`'s signature threads these through: the returned `ObjectRef` is typed
  `ObjectRef<Types, OutputShape<Types, Param>, ParentShape<Types, Param>>`.
  `packages/core/src/builder.ts:150-154`
  ```ts
  objectType<const Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(
    param: Param,
    options: ObjectTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>,
    fields?: ObjectFieldsShape<Types, ParentShape<Types, Param>>,
  ): PothosSchemaTypes.ObjectRef<Types, OutputShape<Types, Param>, ParentShape<Types, Param>>
  ```
- `InputShape` has the identical constructor-unwrapping arm, so a class can also back an
  input shape where relevant. `packages/core/src/types/type-params.ts:51-68`. (Out of
  primary territory; noted for completeness.)

---

## 3. Type-NAME inference from a class (RUNTIME)

- When the param is a class (not a string), the GraphQL type name defaults to the
  **constructor's `.name`** unless an explicit `name` option overrides it.
  `packages/core/src/builder.ts:158-161`
  ```ts
  const name =
    typeof param === 'string'
      ? param
      : ((options as { name?: string }).name ?? (param as { name: string }).name);
  ```
  So `class Race {}` → GraphQL type `Race` unless `{ name: '…' }` is given. Same logic in
  `interfaceType` at `packages/core/src/builder.ts:394-397`.
- The docs' example comment states this correctly:
  `website/playground-examples/fundamentals-objects/variant-classes/schema.ts:23-24`
  ("objectType takes the class as its first argument; the class name / becomes the
  GraphQL type name unless you override it with `name`.").
- **Load-bearing subtlety for docs:** class `.name` is minification-sensitive. Under a
  bundler/minifier that renames classes, an omitted `name` yields a mangled/duplicated
  type name at build time. Recommend giving an explicit `name` in production/bundled
  code. (Behavior is directly implied by the `param.name` fallback above; there is no
  compensating logic in source — verified no other name source in
  `objectType`/`interfaceType`.)
- Collision note: a class named `Giraffe` with no `name` option produces type name
  `Giraffe`, which collides with a separately-registered string type `'Giraffe'`.
  Duplicate typenames throw at build: `packages/core/src/config-store.ts:149-153`
  (`Duplicate typename: Another type with name … already exists.`). The core test suite
  sidesteps this by giving distinct names (`GiraffeFromClass`, string `Giraffe`,
  `GiraffeFromRef`) — `packages/core/tests/examples/giraffes/objects.ts:7,19,38`.

---

## 4. Runtime wiring of `objectType(Class, …)`

Ordered behavior inside `objectType` (`packages/core/src/builder.ts:150-203`):

- `verifyRef(param)` only guards against `undefined` (circular-import diagnostic); it does
  **not** validate that a class is a "real" ref. `packages/core/src/utils/index.ts:50-59`.
- A class param is **not** a `BaseTypeRef`, so a fresh `ObjectRef` is minted for it:
  `packages/core/src/builder.ts:163-166` (`param instanceof BaseTypeRef ? param : new
  ObjectRef(...)`).
- `ref.updateConfig({ … isTypeOf: options.isTypeOf … })` — the class itself is **not**
  stored on the config; only the user-supplied `isTypeOf` is.
  `packages/core/src/builder.ts:168-178`. (This is the key fact behind §5: nothing in
  core derives an `isTypeOf` from the constructor.)
- The class param is then **associated with the new ref** so that fields elsewhere typed
  `type: Class` resolve to this object type:
  `packages/core/src/builder.ts:184-186`
  ```ts
  if (ref !== param && typeof param !== 'string') {
    this.configStore.associateParamWithRef(param, ref);
  }
  ```
  The association store maps the class object → resolved ref:
  `packages/core/src/config-store.ts:78-80`
  (`this.paramAssociations.set(param, resolved);`). This is what makes
  `t.field({ type: Race, … })` (§7) and `interfaces: [Animal]` (a class) resolve.

---

## 5. `isTypeOf` / `resolveType` + `instanceof` — the abstract-type affordance (ledger F4)

**F4 is: classes are not just a backing-model shortcut; they double as the runtime
discriminator for resolving interfaces/unions via `instanceof`.** Write both halves:

### 5a. TYPE-LEVEL: what a class gives the abstract-type machinery
- Nothing automatic. There is no generated `isTypeOf`/`resolveType` from a class at the
  type level. The class only supplies the instance type as the parent shape (§2), which
  is what makes an `instanceof` check well-typed in a user-written `isTypeOf`/
  `resolveType` (the narrowed branch is the class instance).

### 5b. RUNTIME: how `instanceof` actually drives resolution
- **`isTypeOf` is optional and user-supplied only.** Its type: `isTypeOf?:
  GraphQLIsTypeOfFn<unknown, Types['Context']>`.
  `packages/core/src/types/global/type-options.ts:51`.
- **Core never synthesizes an `isTypeOf` from the constructor.** In `buildObject`, the
  object type receives exactly the configured `isTypeOf` (or `undefined`):
  `packages/core/src/build-cache.ts:564-567`
  ```ts
  isTypeOf: config.kind === 'Object'
    ? this.plugin.wrapIsTypeOf(config.isTypeOf ?? undefined, config)
    : undefined,
  ```
  Verified: no `instanceof`-from-class logic exists in `build-cache.ts` or
  `config-store.ts` (all `instanceof` there is ref-kind discrimination). The affordance is
  that the **developer writes** `isTypeOf: (v) => v instanceof Giraffe` — the class is the
  reliable runtime handle that makes this trivial and correct.
- **Interface resolution without any `resolveType`.** A class-backed interface can omit
  `resolveType` entirely; graphql's `defaultTypeResolver` walks the interface's member
  object types and calls each one's `isTypeOf`. Core wires this fallback:
  `packages/core/src/build-cache.ts:588`
  ```ts
  const resolver = config.resolveType ?? defaultTypeResolver;
  ```
  Canonical evidence in-tree: the `Animal` interface defines **no** `resolveType`
  (`packages/core/tests/examples/giraffes/interfaces.ts:5-13,15-22`), yet a field returning
  `new Giraffe(...)` resolves to the `Giraffe` object type purely because that object type
  declares `isTypeOf: (value) => value instanceof Giraffe`
  (`packages/core/tests/examples/giraffes/objects.ts:9,22,41`).
- **So the F4 story for interfaces has two equivalent shapes:**
  1. Put `isTypeOf: v => v instanceof Sub` on each **object** type; leave the interface's
     `resolveType` unset (default resolver dispatches). Preferred when subtypes are
     classes.
  2. Put a single `resolveType: v => v instanceof Sub ? 'Sub' : …` on the **interface**.
     `resolveType` type: `packages/core/src/types/global/type-options.ts:104-110` — it may
     return an `ObjectParam` (including a class), a type name string, or null/undefined.
- **Unions** work the same way via `defaultTypeResolver` when no `resolveType` is set:
  `packages/core/src/build-cache.ts:625-627`. A union `resolveType` may likewise return a
  class/ref/string; the builder resolves a returned ref/class to its type name:
  `packages/core/src/build-cache.ts:642-650`. Real example (errors plugin) using classes:
  `packages/plugin-errors/tests/manual-error-union.test.ts:48-54`
  (`isTypeOf: (value) => value instanceof NotFoundError`).
- **Precedence — `typeBrandKey` beats everything.** Before consulting
  `resolveType`/`isTypeOf`, both interface and union resolvers check for an explicit brand
  set by `brandWithType`. Interface: `packages/core/src/build-cache.ts:578-586`
  (`const typeBrand = getTypeBrand(parent); if (typeBrand) return …`). Union:
  `:615-623`. `getTypeBrand`/`brandWithType`: `packages/core/src/utils/index.ts:91-108`.
  Docs implication: `instanceof`-based resolution is the mechanism for *unbranded*
  values; a value branded via a plugin (e.g. loadable/dataloader) short-circuits ahead of
  the `instanceof` check. Do not present `instanceof` as the *only* resolution path.

---

## 6. Interop with objectRef and SchemaTypes-registered styles

- **Same return type.** `objectType(Class, …)` and `objectType(objectRef, …)` and
  `objectType('Name', …)` all return a `PothosSchemaTypes.ObjectRef<…>`
  (`packages/core/src/builder.ts:154`). Downstream, a class-backed type is used exactly
  like any other ref — as a field `type`, as an interface entry, as a union member.
- **A class can implement class-backed or ref-backed interfaces interchangeably.** The
  giraffe example implements the same object three ways against three interface forms:
  class interface `[Animal]`, string interface `['Animal']`, and ref interface
  `() => [AnimalRef]` — `packages/core/tests/examples/giraffes/objects.ts:8,21,40`. Mixing
  is allowed because `interfaces` accepts any `InterfaceParam[]`.
- **objectRef → class is NOT a thing; class → ref IS.** You cannot pass a class to
  `objectRef()` (which takes a `name: string`, `packages/core/src/builder.ts:685`). The
  supported direction is: define with a class, receive an `ObjectRef` back, use that ref.
- **`ImplementableObjectRef.implement` is ref-only.** The `.implement({...})` fluent form
  is a method on `ImplementableObjectRef` and forwards to `objectType(this, …)`
  (`packages/core/src/refs/object.ts:49-64`). There is no class equivalent of
  `.implement` — with a class you always call `builder.objectType(Class, …)`.
- **Relationship to F2/F3 (cross-dossier):** registering a class (or its instance shape)
  on the `Objects`/`Interfaces` generic is orthogonal to class-backed definition.
  Registration centralizes type identities for reference-by-string (ledger F2); it is
  **not** required to use a class class-backed (§1). Do not conflate the two.

---

## 7. Using a class directly as a field type

- Because `OutputType` includes the constructor arm (§1), a class is a valid `type:` for a
  field, and the field's resolved shape is the instance type (via `OutputShape`).
  Example: `packages/core/tests/examples/giraffes/objects.ts:55-58`
  (`giraffeClass: t.field({ type: Giraffe, resolve: () => new Giraffe(...) })`) and list
  form `type: [Race]` in `website/playground-examples/fundamentals-objects/variant-classes/schema.ts:40`.
- Runtime resolution of `type: Class` to the concrete GraphQL type relies on the
  param→ref association recorded in §4 (`associateParamWithRef`). If you reference a class
  as a field type but never call `objectType`/`interfaceType` with it, there is no
  association and the build cannot resolve it (it is an unimplemented type). (Behavior
  follows from association being created only inside `objectType`/`interfaceType`;
  verified no other association site for classes.)

---

## 8. Class-backed interfaces

- `interfaceType(Class, …)` mirrors `objectType`: name defaults to `class.name`
  (`packages/core/src/builder.ts:394-397`), a new `InterfaceRef` is minted unless the param
  is already a `BaseTypeRef` (`:399-410`), the class is associated with the ref
  (`:432-434`), and `resolveType` is copied from options onto the config
  (`:422`).
- The interface's parent/return shapes come from the same `ParentShape` /
  `AbstractReturnShape` machinery; `AbstractReturnShape` falls back to `OutputShape` when
  no `resolveType`-derived shape is present
  (`packages/core/src/types/type-params.ts:39-49`), so a class-backed interface's parent is
  the class instance type.
- Practical pattern (F4): define an **abstract base class** as the interface and
  **subclasses** as the object types; put `isTypeOf: v => v instanceof Sub` on each object
  type and let the interface use the default resolver (§5b). The `Animal`(base) /
  `Giraffe`(subclass) pair in `packages/core/tests/examples/giraffes/` is exactly this.

---

## 9. Docs-writing guidance derived from ledger (what to recommend vs. what code does)

- **S1 (binding editorial):** frame class-backed types as fully valid and *especially*
  natural when the app already has domain classes. Never "older"/"second-class"/"reach for
  only when…". objectRef may be the running default the docs teach with, presented as *a*
  choice, not *the* correct one.
- **F4 (binding factual):** the docs MUST present the `instanceof` affordance as a
  first-class reason to use classes, not a footnote. Concretely: "Because your value is a
  class instance, `isTypeOf: (v) => v instanceof Race` (or a `resolveType` returning the
  class) resolves interfaces and unions with no extra bookkeeping." Tie it to §5b's two
  shapes.
- **S3 (example pedagogy):** the current class example uses `Race`, which the maintainer
  flagged as a weak first object type (ledger S3). Docs SHOULD pick a class that a working
  dev would genuinely model as a class with behavior (e.g. a `User`/`Money`/`Post` with
  methods, or an error-class hierarchy that naturally motivates `instanceof`
  resolution). The error-class → union pattern
  (`packages/plugin-errors/tests/manual-error-union.test.ts`) is a strong, honest motivator
  for F4 because `instanceof` on `Error` subclasses is idiomatic.
- **S2 (define by what things are):** describe class-backed types as "define a type from a
  class; its instances become the parent, and `instanceof` becomes your type
  discriminator" — not "unlike objectRef, you don't need a separate interface."
- **A1/A3 (anti-slop):** avoid "the class just works as your backing model" hand-waves.
  State the two concrete mechanics: (1) instance type = parent shape (§2); (2) class name =
  type name unless overridden (§3).

---

## 10. Minification / name-default caveat (recommendation, flagged)

- **What the code does:** omitted `name` ⇒ `param.name` (§3), i.e. the runtime constructor
  name. **What docs should recommend:** pass an explicit `name` when code is bundled/
  minified, since constructor names are not guaranteed stable. This is a
  recommendation, not observed core behavior; there is no source that re-derives the name.

---

## 11. UNRESOLVED

- **UNRESOLVED: whether any plugin auto-derives `isTypeOf` from a class constructor.** I
  verified core (`build-cache.ts`, `config-store.ts`, `builder.ts`) does not, and that the
  errors/prisma examples write `instanceof` by hand. I did not exhaustively read every
  plugin's `wrapIsTypeOf`/`wrapResolveType` implementation
  (`packages/core/src/plugins/plugin.ts:157-160` is the no-op base;
  `packages/core/src/plugins/merge-plugins.ts:135-140` chains them). If a specific plugin
  (e.g. errors, dataloader) injects `instanceof`/brand-based resolution, that belongs in
  that plugin's dossier — checked only that the *core* default is pass-through.
- **UNRESOLVED: exact TS behavior when a class instance carries `outputShapeKey`.**
  `OutputShape`'s constructor arm unwraps `U extends { [outputShapeKey]: infer V }`
  (`type-params.ts:22-26`), but I found no in-repo class that brands its instances this
  way, so I could not exercise the branch empirically. The type-level path is clear from
  source; runtime impact is nil (branding is a type-only symbol here).
