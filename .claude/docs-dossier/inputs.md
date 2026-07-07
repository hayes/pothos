# Dossier: Input objects (`builder.inputType`, `builder.inputRef`, input fields)

Territory: everything an Inputs fundamentals page needs, from source only — the
`builder.inputType(name, { fields })` signature and options; the INPUT field
builder (`t.string`/`t.field`/…) and how it differs from `t.arg`; recursive /
self-referential inputs via `builder.inputRef(...).implement(...)`; nested
inputs (an input used as a field of another input); `required`/`defaultValue`
on input fields; whether args and input fields share options; and the
surprises in `InputObjectTypeOptions` (`isOneOf`). Closes with a claim-by-claim
audit of `website/content/docs/fundamentals/inputs.mdx`.

All line citations are into the worktree at
`.../scratchpad/pg-audit/packages/core/src/...` unless noted. Page audited:
`website/content/docs/fundamentals/inputs.mdx`; playground example
`website/playground-examples/fundamentals-inputs/schema.ts`.

Convention: **[runtime]** = executed code that changes the emitted schema;
**[type-level]** = affects only what TypeScript accepts. **UNVERIFIED** = not
asserted anywhere in `packages/core` source I read (typically standard
graphql-js behavior).

---

## 0. Two ways to create an input object

- **`builder.inputType(name, options)`** — the inline/eager form
  (`builder.ts:618-669`). One call both names the type and supplies its fields.
- **`builder.inputRef<T>(name)` then `.implement(options)`** — the deferred
  form for self-reference (`builder.ts:671-683`; `implement` on
  `ImplementableInputObjectRef`, `refs/input-object.ts:53-83`). `.implement`
  simply calls `this.builder.inputType(this, options)` (`input-object.ts:71-79`)
  — so both forms funnel through the same `inputType` runtime. This mirrors the
  `objectRef(...).implement(...)` pattern (`builder.ts:685-687`).

---

## 1. `builder.inputType(param, options)` — exact signature

Runtime — `builder.ts:618-669`:

```ts
inputType<
  Param extends InputObjectRef<Types, unknown> | string,
  Fields extends /* shape-derived */ InputFieldMap,
  IsOneOf extends boolean = boolean,
>(
  param: Param,
  options: PothosSchemaTypes.InputObjectTypeOptions<Types, Fields> & {
    isOneOf?: IsOneOf;
  },
): PothosSchemaTypes.InputObjectRef<
  Types,
  [IsOneOf] extends [true] ? OneOfInputShapeFromFields<Fields> : InputShapeFromFields<Fields>
>
```

Facts:

- **First arg is the type name** (a `string`) or an existing `InputObjectRef`
  (`builder.ts:619`, `:636`). For a string it constructs
  `new InputObjectRef<Types, InputShapeFromFields<Fields>>(name)`
  (`builder.ts:638-640`); for a ref it reuses that ref (the `.implement` path).
  The GraphQL type name is exactly this string — `name = typeof param === 'string'
  ? param : param.name` (`builder.ts:636`). **There is no `name` option**; naming
  is positional (contrast root types, which have a `name` option).
- **`options.fields` is REQUIRED** — it is the only required member of
  `InputObjectTypeOptions` (`type-options.ts:90`, no `?`). Everything else on the
  options object is optional.
- **[runtime]** Writes the type config via `ref.updateConfig({ kind:'InputObject',
  graphqlKind:'InputObject', name, isOneOf: options.isOneOf, description,
  pothosOptions: options, extensions, astNode })` (`builder.ts:647-656`), then
  registers it with `this.configStore.addTypeRef(ref)` (`builder.ts:658`) — the
  registration is what makes it a real type and triggers the duplicate-typename
  guard (§7). Fields are attached lazily via
  `this.configStore.addInputFields(ref, () => options.fields(new InputFieldBuilder(this,'InputObject')))`
  (`builder.ts:664-666`).
- **Returns the `InputObjectRef`** (`builder.ts:668`), which you pass as a field's
  `type` / an arg's `type`.

### `InputObjectTypeOptions` — the exact option set

`type-options.ts:84-91`:

```ts
export interface InputObjectTypeOptions<
  Types extends SchemaTypes = SchemaTypes,
  Fields extends InputFieldMap = InputFieldMap,
> extends BaseTypeOptions<Types> {
  isOneOf?: boolean;
  astNode?: InputObjectTypeDefinitionNode;
  fields: (t: InputFieldBuilder<Types, 'InputObject'>) => Fields;
}
```

`BaseTypeOptions` adds `description?`, `extensions?`, `astNode?`
(`type-options.ts:33-37`). So the complete verified option set for `inputType`:

| option | type | source |
|---|---|---|
| `fields` (**required**) | `(t: InputFieldBuilder<Types,'InputObject'>) => Fields` | `type-options.ts:90` |
| `isOneOf?` | `boolean` | `type-options.ts:88` (and top-level `isOneOf?: IsOneOf` on the call, `builder.ts:628-630`) |
| `description?` | `string` | `type-options.ts:34` (`BaseTypeOptions`) |
| `extensions?` | `Readonly<Record<string, unknown>>` | `type-options.ts:35` |
| `astNode?` | `InputObjectTypeDefinitionNode` | `type-options.ts:89` (narrows the `BaseTypeOptions` node) |

- **No `$defaults` in core** — grep for `$defaults` in `packages/core/src` finds
  nothing (only an unrelated comment about scalar defaults, `type-options.ts:150`).
  If a page mentions `$defaults`, it is not a core input-type feature.
- **No `name`/rename option** — the name is the first positional arg (§1).

---

## 2. The INPUT field builder — what `t` exposes inside `fields`

The `t` handed to an `inputType` `fields` callback is
`new InputFieldBuilder(this, 'InputObject')` (`builder.ts:665`), i.e. the
**same `InputFieldBuilder` class** that backs args, but with `kind:'InputObject'`
(`fieldUtils/input.ts:16-19`, `:84-87`). It exposes (all in `input.ts`):

| member | builds | source |
|---|---|---|
| `t.field({ type, … })` | general input field (any input type / list) | `input.ts:122-173` |
| `t.string / .int / .id / .boolean / .float` | scalar input field | `input.ts:28-52` |
| `t.stringList / .intList / .idList / .booleanList / .floatList` | scalar-list input field | `input.ts:58-82` |
| `t.listRef(type, { required? })` | list ref with item-level requiredness | `input.ts:89-96` |

- **KEY DIFFERENCE from args:** the input-field `t` is a **plain class instance**
  — you call `t.field(...)`, `t.string(...)`, etc. It is **NOT itself callable**:
  you cannot write `t({ type })` inside `inputType`. `t.arg`, by contrast, is a
  callable object (the bound `field` method with the helpers copied on) produced
  by `argBuilder()` (`input.ts:98-116`), which is only applied for the `'Arg'`
  kind. So: **args use `t.arg(...)`; input fields use `t.field(...)`** for the
  general form. (The `.string`/`.int`/… helper *names* are identical on both.)
- The scalar helpers are the same 10 as args, each `= this.helper(<type>)`
  (`input.ts:28-82`); `helper` pre-fills `type` and calls `field`
  (`input.ts:175-188`). There is **no** helper for custom scalars / enums /
  nested input objects — use `t.field({ type })` (§3).

---

## 3. Nested inputs — an input as a field of another input

Mechanics: an input field's `type` accepts any `InputType<Types>` or a
`[InputType<Types>]` list (`input.ts:122`), and `InputObjectRef` /
`ImplementableInputObjectRef` are input types. So `t.field({ type: OtherInput })`
or `t.field({ type: [OtherInput] })` nests one input inside another. At build
time the ref is resolved by `inputTypeFromParam` (`input.ts:158`), identical to
any other input type.

- **REAL example (test-verified):**
  `packages/core/tests/examples/giraffes/inputs.ts:3-9,24-35` — `GiraffeInput`
  is a plain `inputType`, and `RecursiveGiraffeInput` has a field
  `friends: t.field({ type: [GiraffeInput] })` (`inputs.ts:31-33`) — an input
  field whose type is a **list of another input type**. It is consumed by a real
  mutation arg (`inputs.ts:57`) and exercised in the giraffes example schema.
- **Also:** `random-stuff.ts:143-151` (`Example3`) nests `example: t.field({
  type: Example, required: true })` (another `inputType`, `random-stuff.ts:98`)
  plus a self-reference `more: t.field({ type: Example3, required: true })` (§4).

---

## 4. Recursive / self-referential inputs — the pattern that WORKS

The self-reference problem: a `const X = builder.inputType('X', { fields: (t) =>
({ children: t.field({ type: [X] }) }) })` would reference `X` before its
initializer completes. Two verified solutions:

- **Preferred (page's pattern): split declaration from implementation.**
  ```ts
  const Filter = builder.inputRef<IFilter>('Filter');
  Filter.implement({ fields: (t) => ({ and: t.field({ type: [Filter] }), … }) });
  ```
  `inputRef<T>(name)` returns an `ImplementableInputObjectRef` **with no fields
  yet** (`builder.ts:671-683`); the ref value exists immediately, so the fields
  callback (which runs lazily at build) can safely close over `Filter`.
  **Test-verified:** `random-stuff.ts:132-141` — `const Example2 =
  builder.inputRef<ExampleShape, false>('Example2')` then `Example2.implement({
  fields: (t) => ({ …, more: t.field({ type: Example2, required: true }) }) })`
  self-references `Example2`. Used as an arg at `random-stuff.ts:191` and
  dereferenced `args.example2.more.more.more.example.id` (`:194`), proving the
  recursive TS shape resolves.
- **Also works inline** because field callbacks are lazy thunks:
  `random-stuff.ts:143-151` (`export const Example3 = builder.inputRef<ExampleShape>('Example3').implement({ fields: (t) => ({ …, more: t.field({ type: Example3 }) }) })`)
  references `Example3` inside its own `.implement` callback. Works at runtime
  (thunk defers evaluation until after `const Example3` is bound) but reads worse;
  the split form is the one to teach.
- **Why the type is needed up front:** `inputRef<T>` takes the TS shape `T` as a
  type parameter (`builder.ts:671`) and normalizes it via
  `RecursivelyNormalizeNullableFields<T>` (`builder.ts:674-676`). Because the
  shape is supplied explicitly, TypeScript never has to infer a
  circular field map — that is what makes the recursion type-check. `inputType`
  (inline) instead *infers* the shape from `Fields`, which cannot close a cycle.
- **The `Normalize`/second type param:** `inputRef<T, Normalize = true>`
  (`builder.ts:671`). With `Normalize extends false` (as `Example2`,
  `random-stuff.ts:132`) the resolved shape is the raw `T`; otherwise
  `RecursivelyNormalizeNullableFields<T>` (`builder.ts:674-682`). Advanced —
  a fundamentals page can omit it.

---

## 5. `required` / `defaultValue` on input fields — same as args

- The option object for an input field is `InputObjectFieldOptions`, which is an
  **empty extension of `InputFieldOptions`** (`field-options.ts:279-283`) — the
  identical interface args use (§6). So `required`, `defaultValue`, `description`,
  `deprecationReason`, `extensions`, `astNode`, `type` all mean the same thing.
- **[runtime]** In `field()`, the `'InputObject'` branch reads the options
  identically to the `'Arg'` branch: `type: inputTypeFromParam(opts.type, …,
  opts.required ?? this.builder.defaultInputFieldRequiredness)`,
  `defaultValue: opts.defaultValue`, etc. (`input.ts:149-170` vs `:125-148`).
- **Default requiredness is `false` (optional/nullable)** — the same
  `defaultInputFieldRequiredness` builder field, default `false`
  (`builder.ts:122-127`), governs args AND input fields (`input.ts:139`, `:161`).
  So an input field with no `required` is nullable; `required: true` ⇒ NonNull.
- **`defaultValue` is delegated to graphql-js**, not applied by Pothos: it is
  copied onto the input-field config (`input.ts:166`) and spread into the emitted
  `GraphQLInputFieldConfig` at build (`build-cache.ts` input-field build). The
  "default substituted when the client omits the field, but explicit `null`
  passes through" rule is graphql-js coercion behavior — **UNVERIFIED** in
  `packages/core`. `random-stuff.ts:108-112` shows a legal `defaultValue: null`
  on a `required: false` field.

---

## 6. Do args and input-object fields take the same options? YES (re-cite)

The args dossier's finding, re-verified for this page:

- Both `t.arg(...)` and input `t.field(...)` are the **same**
  `InputFieldBuilder.field()` method, branching only on `kind` for which ref to
  build (`input.ts:122-173`).
- The option interfaces are literally empty extensions of the same base:
  ```ts
  export interface ArgFieldOptions<…>         extends InputFieldOptions<Types, Type, Req> {}  // field-options.ts:273-277
  export interface InputObjectFieldOptions<…> extends InputFieldOptions<Types, Type, Req> {}  // field-options.ts:279-283
  ```
  `InputFieldOptionsByKind` maps `Arg → ArgFieldOptions`,
  `InputObject → InputObjectFieldOptions` (`field-options.ts:285-292`). Both add
  **nothing** to `InputFieldOptions` (`field-options.ts:253-271`: `type`,
  `description`, `deprecationReason`, `required`, `defaultValue`, `extensions`,
  `astNode`).
- **Conclusion: HONEST.** In core, input fields and args accept an identical
  option set and share requiredness / `defaultValue` semantics. The page's "the
  fields inside `inputType` use the same `required` and `defaultValue` options as
  field arguments" is accurate. (Caveat preserved: the two interfaces are
  *distinct* empty interfaces, so a plugin can declaration-merge onto one but not
  the other — so it is a "same **core** options" statement.)

---

## 7. `isOneOf` — the surprise, and how it flows

- **It exists in core.** `isOneOf?: boolean` on `InputObjectTypeOptions`
  (`type-options.ts:88`) AND as a top-level `isOneOf?: IsOneOf` on the `inputType`
  call signature (`builder.ts:628-630`), where `IsOneOf extends boolean` is a
  distinct type param.
- **[type-level]** It changes the resolved TS shape: the return ref's shape is
  `[IsOneOf] extends [true] ? OneOfInputShapeFromFields<Fields> :
  InputShapeFromFields<Fields>` (`builder.ts:631-634`).
  `OneOfInputShapeFromFields` (`builder-options.ts:232-243`) is a discriminated
  union — **exactly one** field present (non-null) and all others `?: never`. So
  a one-of input is `{ a: string; b?: never } | { b: string; a?: never }`.
  Non-one-of uses `InputShapeFromFields` = the normal all-optional object
  (`builder-options.ts:245-247`).
- **[runtime]** `isOneOf: options.isOneOf` is written into the type config
  (`builder.ts:651`); `PothosInputObjectTypeConfig extends
  Omit<GraphQLInputObjectTypeConfig,'fields'>` (`types/configs.ts:88-92`), so
  `isOneOf` is a legitimate graphql-js config key. `buildInputObject` spreads the
  whole config into `new GraphQLInputObjectType({ ...config, … })`
  (`build-cache.ts:670-679`), handing `isOneOf` straight to graphql-js. graphql-js
  here is **v17.0.1** (`node_modules/graphql/package.json`), which supports
  `@oneOf` natively.
- **Test-verified:** `random-stuff.ts:353-359` builds
  `builder.inputType('OneOfExample', { isOneOf: true, fields: (t) => ({ a:
  t.string(), b: t.string() }) })` and the resolver reads `oneOf.a ?? oneOf.b`
  (`:363-364`). Present in the schema snapshot.
- **Docs note:** the current inputs page does **not** mention `isOneOf` at all.
  It is a real feature the page could add (or deliberately defer). Flagging so the
  draft decides consciously — this is the one non-obvious surprise in
  `InputObjectTypeOptions`.

---

## 8. Uniqueness / duplicate-name behavior

- **"Defined once" is enforced at build via the duplicate-typename guard.**
  `addTypeRef` throws `Duplicate typename: Another type with name ${config.name}
  already exists.` if a *different* ref claims a name already registered
  (`config-store.ts:149-153`). So the page's "each input object can only be
  defined once across your whole schema" is accurate for two *different*
  `inputType('Same', …)` calls.
- Calling `.implement()` twice on the same ref, or re-registering the same ref,
  early-returns (`config-store.ts:135-138`) — but two independent inputs sharing a
  name collide. Duplicate **field** names within one input throw
  `Duplicate field ${fieldName} on ${config.name}` (`config-store.ts:176-178`).

---

## 9. Inventory of the current page (`inputs.mdx`) — claim by claim

Line refs into `website/content/docs/fundamentals/inputs.mdx` and
`website/playground-examples/fundamentals-inputs/schema.ts`.

| # | Claim | Verdict | Note |
|---|---|---|---|
| L12 | `input.name` is `string`, `input.age` is `number` | **CORRECT** | Both `required: true` scalars in the example (`schema.ts:48-49`), so non-null (§5). |
| L16 | "The first argument to `builder.inputType` is the GraphQL type name" | **CORRECT** | `builder.ts:627,636`. |
| L16-20 | Naming convention `<Operation><Subject>Input` | Convention, not source | Stylistic; nothing in core enforces it. Fine as guidance. |
| L22 | "Each input object can only be defined once … pick a name no other field will collide with" | **CORRECT** | Duplicate-typename guard (§8, `config-store.ts:149-153`). Minor wording nit: collision is with another **type**, not "field". |
| L28-47 | Share an input via a top-level `const` and reference it in two fields | **CORRECT** | Refs are reusable values; `t.arg({ type: FactionFilter })` per args mechanics. |
| L49 | "GraphQL doesn't see a difference between an inline and a shared input" | **CORRECT** | Both funnel through `inputType`; the ref/name is identical. |
| L53 | "fields inside `inputType` use the same `required` and `defaultValue` options as field arguments" | **CORRECT / HONEST** | §6 — identical `InputFieldOptions`. |
| L55-61 | `t.string({ required: true })`, `t.string({ defaultValue: 'Neutral' })`, `t.stringList({ required: true, defaultValue: [] })` | **CORRECT** | All valid `InputFieldOptions` combos (§5). `defaultValue: []` on a required list is legal. |
| L63 | "Inputs can also nest: an input field's type can be another input type" | **CORRECT** | §3; real test at `giraffes/inputs.ts:31-33`. Page states it but shows no example — the curriculum wants a REAL nested example; `friends: t.field({ type: [OtherInput] })` is the honest one to use. |
| L67-85 | Recursive input via `builder.inputRef<IFilter>('Filter')` then `Filter.implement({ fields: (t) => ({ and: t.field({ type: [Filter] }), … }) })` | **CORRECT** | Exactly the verified pattern (§4; matches `random-stuff.ts:132-141`). |
| L87 | "The split mirrors the `objectRef` pattern … declare the reference up front so the type can refer to itself" | **CORRECT** | `inputRef`/`objectRef` are parallel `Implementable*Ref.implement` (`builder.ts:671-687`, `refs/input-object.ts:53-83`). |
| schema.ts L45-53 | `t.arg({ type: builder.inputType('AddCharacterInput', { fields }), required: true })` — inline input as an arg type | **CORRECT** | Inline `inputType` returns a ref usable as `type` (§1). |

**No factual errors found on this page.** The two gaps are omissions, not
mistakes: (a) L63 asserts nesting but shows no example — supply the
`t.field({ type: [OtherInput] })` form; (b) `isOneOf` is never mentioned (§7).

---

## 10. Surprising / docs-relevant details

- **Input `t` is NOT callable** — use `t.field({ type })`, never `t({ type })`.
  `t.arg` is callable; the input-field builder is a plain instance (§2). This is
  the single most likely learner trap; the page correctly uses `t.field`.
- **`inputType` name is positional; there is no `name` option** and **no
  `$defaults`** in core (§1).
- **`inputRef(...).implement(...)` is the recursion pattern**, and it works
  because the TS shape is passed to `inputRef<T>` explicitly, breaking the
  inference cycle (§4).
- **Args and input fields share one identical core option set** (`InputFieldOptions`),
  same requiredness (`defaultInputFieldRequiredness` default `false`) and
  `defaultValue` (delegated to graphql-js) semantics (§5, §6).
- **`isOneOf: true`** exists in core, changes the TS shape to a discriminated
  "exactly one key" union, and is handed to graphql-js v17's native `@oneOf`
  (§7). The page omits it.
- **UNVERIFIED:** the "default applied on omit, not on explicit `null`" coercion
  rule is graphql-js behavior, not asserted in `packages/core`.
