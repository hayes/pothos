# Dossier: Interfaces (fundamentals)

Territory: `builder.interfaceType` / `builder.interfaceRef` / `interfaceRef(...).implement(...)`;
the `interfaces: [...]` option on object (and interface) types and what type-level
checking happens on it; abstract-type resolution (`resolveType` on the interface vs
`isTypeOf` on members, precedence, and the NEITHER case); the class-backed `instanceof`
tie-in; `__typename` polymorphic selection (client-side); how member backing models
relate to the interface's; and a claim-by-claim inventory of
`website/content/docs/fundamentals/interfaces.mdx`.

All paths relative to the worktree root (`…/pg-audit/`). Citations are
`packages/core/src/<file>:<line>` unless noted as a test/example/website path.

---

## 0. Terminology

- **Interface param** = the first argument to `builder.interfaceType`. Like `ObjectParam`,
  it is a three-arm union: a registered `Interfaces` key (string), an `InterfaceRef`, or a
  bare **constructor** (class). `types/type-params.ts:127` (see class-backed dossier §1 for
  the full quote — `InterfaceParam` = `Extract<…, keyof Types['Interfaces']> | InterfaceRef | (new (...args) => unknown)`).
- **Backing model / parent shape** = the TS shape a resolver on the interface receives as
  `parent`, computed by `ParentShape<Types, Param>`.

---

## 1. `builder.interfaceType` — exact signature & options

- Signature: `builder.ts:378-390`
  ```ts
  interfaceType<Param extends InterfaceParam<Types>, const Interfaces extends InterfaceParam<Types>[], ResolveType>(
    param: Param,
    options: InterfaceTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces, ResolveType>,
    fields?: InterfaceFieldsShape<Types, ParentShape<Types, Param>>,
  ): PothosSchemaTypes.InterfaceRef<Types, AbstractReturnShape<Types, Param, ResolveType>, ParentShape<Types, Param>>
  ```
  Note: `fields` may be passed as a third positional arg OR inside `options.fields` — the
  runtime wires BOTH (`builder.ts:436-442`, `if (fields)` then `if (options.fields)`).
- Option set — `InterfaceTypeOptions` at `types/global/type-options.ts:93-111` extends
  `BaseTypeOptions` (`:33-37`: `description?`, `extensions?`, `astNode?`) and adds:
  - `fields?: InterfaceFieldsShape<Types, Shape>` (`:99`)
  - `interfaces?: (() => Interfaces & …[]) | (Interfaces & …[])` (`:101-103`) — **an
    interface CAN implement other interfaces** (array or lazy thunk). Confirmed wired at
    runtime: `builder.ts:428-430` (`if (options.interfaces) ref.addInterfaces(...)`) and the
    built `GraphQLInterfaceType` receives them at `build-cache.ts:600`
    (`interfaces: () => config.interfaces.map(...)`).
  - `resolveType?` (`:104-110`) — see §3.
  - `astNode?: InterfaceTypeDefinitionNode` (`:100`).
  - There is NO `isTypeOf` on interface options — `isTypeOf` lives only on **object**
    options (`ObjectTypeOptions.isTypeOf`, `:51`). This is the mechanical basis of the
    "interface has resolveType, members have isTypeOf" split.
- Runtime wiring of `interfaceType` (`builder.ts:391-444`): `verifyRef(param)` (undefined
  guard only, `utils/index.ts:50-59`); `verifyInterfaces(options.interfaces)`
  (`utils/index.ts:61-89` — must be array/function/falsy, and no `undefined` entries, else
  `PothosSchemaError`); name defaults to `param.name` for a class or explicit `name`
  (`builder.ts:394-397`, same logic as objects); a fresh `InterfaceRef` is minted unless
  `param instanceof BaseTypeRef` (`:399-410`); `resolveType` is copied onto the config
  (`:422`); class/ref params are associated with the ref (`:432-434`).

## 2. `builder.interfaceRef` and `.implement(...)`

- `builder.interfaceRef<T>(name)` → `ImplementableInterfaceRef<Types, T>`, taking ONLY a
  name string: `builder.ts:689-691`.
- `ImplementableInterfaceRef.implement(options)` forwards to `builder.interfaceType(this, options)`:
  `refs/interface.ts:41-50`. Its options type is
  `InterfaceTypeOptions<Types, ImplementableInterfaceRef<…>, Parent, Interfaces>` — note it
  does NOT `Omit<…, 'name'>` (interface options never carried a `name`; the name comes from
  the ref), unlike `ImplementableObjectRef.implement` which omits `name`
  (`refs/object.ts:49-64`). So the ref-creation / `implement` option split is the same story
  as objects: identity+name at `interfaceRef(name)`, everything else in `.implement(...)`.
- `ImplementableInterfaceRef extends InterfaceRef` (`refs/interface.ts:29-33`); both carry
  the phantom `[outputShapeKey]`/`[parentShapeKey]` type channels (`:20-22`).

## 3. `resolveType` — the interface's abstract-type resolver

### 3a. TYPE-LEVEL contract
- `InterfaceTypeOptions.resolveType` (`types/global/type-options.ts:104-110`):
  ```ts
  resolveType?: ResolveType &
    ((parent: Shape, context: Types['Context'], info: GraphQLResolveInfo, type: GraphQLUnionType)
      => MaybePromise<ObjectParam<Types> | string | null | undefined>);
  ```
  - `parent` is typed as the interface's `Shape` (its parent/backing model).
  - Return: `ObjectParam` (a member string name, an ObjectRef, or a **class**), OR a bare
    type-name `string`, OR `null`/`undefined`, possibly promised (`MaybePromise`).
  - **Source curiosity (worth flagging, not a docs claim):** the 4th param is typed
    `GraphQLUnionType` even for an interface — at runtime graphql passes the
    `GraphQLInterfaceType`. Cosmetic type inaccuracy in the option; does not affect the
    documented one-liner `resolveType: (val) => val.kind`.
- The presence/absence of `resolveType` also drives the interface's **return** shape via
  `AbstractReturnShape<Types, Param, ResolveType>` (`types/type-params.ts:39-49`): when
  `ResolveType` is `unknown` (no custom resolveType) it uses the ref's
  `abstractReturnShapeKey` shape or falls back to `OutputShape`; otherwise `OutputShape`.
  Threaded as the interface ref's output-shape generic (`builder.ts:386-390`).

### 3b. RUNTIME wiring (who resolves, in what order)
`buildInterface` (`build-cache.ts:577-606`) installs a resolver with this precedence:
1. **Type brand wins first.** `getTypeBrand(parent)` (`utils/index.ts:102-108`, reads the
   non-enumerable `typeBrandKey` set by `brandWithType`, `:91-100`): if a string, return it;
   if a ref, return `getTypeConfig(typeBrand).name`. `build-cache.ts:578-586`.
2. **Then the configured `resolveType`, else graphql's `defaultTypeResolver`.**
   `build-cache.ts:588` — `const resolver = config.resolveType ?? defaultTypeResolver;` then
   `return resolver(parent, context, info, type)` (`:590`).
- Final resolver is wrapped by plugins: `resolveType: this.plugin.wrapResolveType(resolveType, config)`
  (`build-cache.ts:602`). Base plugin `wrapResolveType` is pass-through (see class-backed
  dossier §11 / `plugins/plugin.ts`).
- **ASYMMETRY vs unions (flag for docs, do not over-promise).** `buildInterface` returns the
  resolver's result **verbatim** (`build-cache.ts:590`) — there is NO ref→name normalization
  step. Unions DO normalize a returned ObjectRef/GraphQLObjectType to a name
  (`build-cache.ts:631-651`, the `getResult` helper). So although the interface
  `resolveType` TYPE permits returning an `ObjectParam` (a Pothos ref/class), only a
  returned **string type-name** or a real `GraphQLObjectType` is guaranteed to work at
  runtime for interfaces; a bare Pothos `ObjectRef` return is not normalized here.
  **UNVERIFIED**: whether returning a Pothos `ObjectRef` (not a name string) from an
  *interface* `resolveType` resolves correctly at runtime — the type allows it but
  `buildInterface` has no normalization; I did not exercise it. The documented pattern
  (`return val.kind` — a string) is unaffected and correct.

## 4. `isTypeOf` on member objects — precedence & the NEITHER case

- `isTypeOf` is an **object-type** option only, optional, user-supplied:
  `ObjectTypeOptions.isTypeOf?: GraphQLIsTypeOfFn<unknown, Types['Context']>`
  (`types/global/type-options.ts:51`). Copied onto object config at `builder.ts:176`.
- Built onto the `GraphQLObjectType` only for objects: `build-cache.ts:564-567`
  (`isTypeOf: config.kind === 'Object' ? this.plugin.wrapIsTypeOf(config.isTypeOf ?? undefined, config) : undefined`).
  **Core NEVER synthesizes `isTypeOf`** — it passes through `config.isTypeOf ?? undefined`.
  This confirms consistency with the objects-page claim that `isTypeOf` `instanceof` checks
  are user-written (class-backed dossier §5b agrees).
- **Precedence between the two** (whole-request view): the interface's `resolveType`
  (§3b) is what graphql calls first for a value returned by an interface-typed field. Only
  when the interface has NO `resolveType` does graphql's `defaultTypeResolver` run, and
  *that* is what iterates member objects calling each one's `isTypeOf` until one returns
  true. So: **brand → interface `resolveType` → (fallback) member `isTypeOf` via
  defaultTypeResolver.** `isTypeOf` is not consulted when a `resolveType` is present.
- **NEITHER defined (no interface `resolveType`, no member `isTypeOf`):** `defaultTypeResolver`
  runs (`build-cache.ts:588`) but finds no member whose `isTypeOf` returns true, so **graphql-js**
  (not Pothos) throws at runtime: "Abstract type \"X\" must resolve to an Object type at
  runtime …". This is graphql-js's error, raised during execution of a query that hits such a
  field — NOT a Pothos build-time error. (Pothos does no build-time check that an abstract
  type is resolvable; `verifyInterfaces` only guards `undefined` entries,
  `utils/index.ts:61-89`.)

## 5. The class-backed / `instanceof` tie-in

- A class may be the interface param (`InterfaceParam` constructor arm) and/or the member
  object param. When members are classes, the idiomatic pattern is
  `isTypeOf: (v) => v instanceof Sub` on each object, leaving the interface's `resolveType`
  unset so `defaultTypeResolver` dispatches. Canonical in-tree evidence: the `Animal`
  interface defines NO `resolveType` (`packages/core/tests/examples/giraffes/interfaces.ts`),
  yet `new Giraffe()` resolves because the `Giraffe` object type declares
  `isTypeOf: (value) => value instanceof Giraffe`
  (`packages/core/tests/examples/giraffes/objects.ts:9,22,41`). Full treatment in the
  class-backed dossier §5/§8 — not re-derived here.

## 6. `interfaces: [...]` on object types — what type-checking happens

- The option lives on `ObjectTypeWithInterfaceOptions.interfaces`
  (`types/global/type-options.ts:54-62`): array or lazy thunk of `InterfaceParam[]`.
- **The only Pothos type-level check is backing-model (shape) compatibility, via
  `ValidateInterfaces`** (`types/builder-options.ts:221-230`):
  ```ts
  Interfaces extends InterfaceParam<Types>
    ? Shape extends GetParentShape<Types, Interfaces>
      ? Interfaces
      : 'Object shape must extend interface shape'
    : never;
  ```
  i.e. the object's parent shape must be assignable (`extends`, structural) to the
  interface's parent shape; otherwise the array element's type degrades to the error
  *string*, surfacing as a TS error. `GetParentShape` is `ParentShape` re-imported
  (`builder-options.ts:13`). Wired into both object option types
  (`type-options.ts:59-61`, `:101-103`).
- **Pothos does NOT verify GraphQL field compatibility** (that the object actually declares
  every field the interface requires, with covariant types). There is no such check in
  `builder.ts`/`build-cache.ts` (grep for `must implement`/`assertValid`/`validateSchema`
  in `packages/core/src` returns nothing). That validation is **graphql-js's**, performed
  when the `GraphQLObjectType`/schema is constructed/validated (interfaces are wired at
  `build-cache.ts:568-571` and validated by graphql). So: shape-compat = Pothos (type-level);
  field-compat = graphql-js (build/validation time).
- Runtime: `verifyInterfaces` (undefined-guard only) + `addInterfaces`
  (`refs/base-with-fields.ts:42-58`, empty array is a no-op; supports lazy thunks for
  circular refs).

## 7. Backing model of members vs the interface (structural, not declared)

- The relationship is **structural (TS assignability)**, enforced only when the object sets
  `interfaces: [Iface]` (§6, `ValidateInterfaces`). There is no separate "declare the member's
  backing model against the interface" step — the member's own parent shape (from its
  ref/class/generic) must merely `extend` the interface's parent shape.
- Example alignment (`website/playground-examples/fundamentals-interfaces/schema.ts`):
  interface backing is `ICharacter = IHobbit | IElf | IWizard` (`:24,35`
  `interfaceRef<ICharacter>('Character')`); each member is `objectRef<IHobbit>` etc.
  (`:48,56,65`) and each `IHobbit`/`IElf`/`IWizard` is a member of the `ICharacter` union
  so `extends ICharacter` holds → `interfaces: [Character]` type-checks (`:50,58,67`).

## 8. `__typename` — polymorphic client selection (F6, keep attribution honest)

- `__typename` is a **GraphQL introspection meta-field defined by the GraphQL spec and
  implemented by graphql-js**, available on every object/interface/union position; it
  returns the concrete object type's name (the same name `resolveType`/`isTypeOf` resolve
  to). It is NOT a Pothos construct — there is no `__typename` handling in
  `packages/core/src` (nothing to cite in Pothos; this is graphql-js/spec behavior).
  **F6 attribution:** present `__typename` and fragment spreads (`... on Hobbit { … }`) as
  standard client-side GraphQL, not Pothos features. Pothos's role is only to make
  `resolveType`/`isTypeOf` return the right name so `__typename` and fragments dispatch
  correctly.

---

## 9. Inventory of `website/content/docs/fundamentals/interfaces.mdx`

Line refs are into the mdx.

- L8 "promote shared fields to an interface; concrete types `implement` and add their own" —
  **TRUE.** Matches §1/§6.
- L10 include `playground-examples/fundamentals-interfaces/schema.ts#character-interface` —
  **region EXISTS** (`schema.ts:34,63`). ✔
- L12 "`Hobbit` and `Elf` automatically have `id` and `name`" — **TRUE**: interface fields
  are wired onto the built `GraphQLInterfaceType` and inherited by implementers
  (graphql-js); the example puts `id`/`name` only on the interface (`schema.ts:43-45`).
- L16 "Pothos needs to know which concrete type each value belongs to so it can format the
  response" — **TRUE** (that is what `resolveType`/`defaultTypeResolver` produce, §3b).
- L19 `resolveType: (val) => val.kind` — **TRUE & sound**: returns a **string** name;
  `val.kind` is `'Hobbit' | 'Elf' | 'Wizard'` (`schema.ts:9,14,19`), each matching a
  registered object type name. String return is the safe path (no normalization needed, §3b).
- L22 "The returned string must match the name of one of the implementing types" — **TRUE.**
- L25-30 shape-sniffing `resolveType` (`'shireAddress' in val` → 'Hobbit', etc.) — **TRUE**;
  valid alternative to a discriminator. (Minor: returns 'Wizard' as the fallback; harmless.)
- L32 "As a last resort, every implementing type can provide an `isTypeOf` predicate; Pothos
  calls each in turn until one returns true. Slower than a discriminator-based `resolveType`."
  — **MOSTLY TRUE, ATTRIBUTION IMPRECISE.** Members' `isTypeOf` are only consulted when the
  interface has NO `resolveType` (§4); and it is **graphql-js's `defaultTypeResolver`**, not
  Pothos, that "calls each in turn." Not wrong in effect, but "Pothos calls each" glosses the
  graphql-js layer. Recommend: "graphql falls back to calling each implementing type's
  `isTypeOf` until one returns true." The "slower" framing is defensible (N predicate calls
  vs one discriminator read).
- L36-51 interface fields example (`t.exposeID`/`t.exposeString`/computed `t.string`) with
  "`parent` argument is typed as the interface's backing model — `ICharacter` here" — **TRUE**:
  field builder parent shape is `ParentShape<Types, Param>` (`builder.ts:385`,
  `InterfaceFieldBuilder`), i.e. `ICharacter`.
- L57-71 GraphQL query with `... on Hobbit`/`... on Wizard` fragments — **TRUE**, standard
  client-side GraphQL (§8). Honest: this is spec/graphql-js, not Pothos.
- L73 "A field returning an interface can resolve to any mix of implementing types — Pothos
  uses `resolveType` to dispatch on each one" — **TRUE** (§3b); slight over-attribution
  ("Pothos") since brand/defaultTypeResolver also participate, but acceptable at this altitude.
- L75-77 cross-links to unions/objects — fine.

**No hard-WRONG claims found in interfaces.mdx.** Two attribution softenings recommended
(L32, L73): the `isTypeOf` iteration is graphql-js's `defaultTypeResolver`, and dispatch is
brand → resolveType → defaultTypeResolver, not "Pothos" as a monolith.

---

## 10. Docs-writing guidance (grounded)

- When showing member `isTypeOf`, state the precedence honestly: it is a **fallback** used
  only when the interface has no `resolveType` (§4) — not a co-equal alternate that also runs
  when `resolveType` is present.
- If docs ever show `resolveType` returning a ref/class (not a string), verify it at
  runtime first — interfaces lack the union's ref→name normalization (§3b). The string form
  (`val.kind`) is the safe, documented default.
- Keep `__typename`/fragments framed as client-side GraphQL (F6, §8); Pothos's only job is
  correct type resolution.
- Interfaces-implement-interfaces is real and supported (§1) — safe to mention.

---

## 11. UNRESOLVED / UNVERIFIED

- **UNVERIFIED (runtime):** whether an *interface* `resolveType` returning a Pothos
  `ObjectRef` (rather than a name string or `GraphQLObjectType`) resolves correctly. Type
  permits it (`type-options.ts:104-110`); `buildInterface` performs no ref→name
  normalization (`build-cache.ts:588-590`), unlike unions (`:631-651`). Not exercised.
- **UNVERIFIED (exact wording):** the precise graphql-js error string/site for the
  NEITHER-defined case (§4). I cite the mechanism (`defaultTypeResolver` fallback at
  `build-cache.ts:588`) and that the throw originates in graphql-js execution, not Pothos;
  I did not run a query to capture the literal message.
