# Dossier: Arguments fundamentals (`t.arg`, requiredness, `defaultValue`)

Territory: everything an Arguments page needs, from source only — the `t.arg`
builder and its scalar/list shorthands; the exact option set an arg accepts;
default requiredness and `required: true`; `defaultValue`; how args reach the
resolver and how their TypeScript shape is derived; and whether args and input
object fields genuinely share the same options.

All line citations are into the worktree at
`.../scratchpad/pg-audit/packages/core/src/...` unless noted. The current docs
page audited is `website/content/docs/fundamentals/args.mdx` and its playground
example `website/playground-examples/fundamentals-args/schema.ts`.

Convention: **[runtime]** = executed code that changes the emitted schema;
**[type-level]** = affects only what TypeScript accepts. **UNVERIFIED** = not
asserted anywhere in `packages/core` source I read (typically standard
graphql-js behavior).

---

## 0. Where `t.arg` comes from

- On every field builder, `arg` is a property created once per builder instance:
  `arg: ArgBuilder<Types> = new InputFieldBuilder<Types, 'Arg'>(this.builder, 'Arg').argBuilder();`
  — `fieldUtils/root.ts:22`. So `t.arg` is the object returned by
  `InputFieldBuilder.argBuilder()`.

- `argBuilder()` (`fieldUtils/input.ts:98-116`) returns the builder's `field`
  method (bound), then copies every own + prototype **function** key of the
  `InputFieldBuilder` onto that function (`input.ts:101-113`). The result is a
  **callable object**: you can call `t.arg({...})` (that's `field`) *and* access
  `t.arg.string(...)`, `t.arg.stringList(...)`, `t.arg.listRef(...)` (the copied
  helpers).

- The static type mirrors this exactly:
  ```ts
  export type ArgBuilder<Types extends SchemaTypes> = Omit<
    PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>, 'field'
  > & PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>['field'];
  ```
  `types/builder-options.ts:215-219` — i.e. "all `InputFieldBuilder` members
  except `field`, intersected with the callable signature of `field`." That is
  why `t.arg` is simultaneously a function and a namespace of helpers.

- The **same** `InputFieldBuilder` class backs both args (`kind: 'Arg'`) and
  input-object fields (`kind: 'InputObject'`) — `fieldUtils/input.ts:16-19`. The
  only per-kind difference in `field()` is which ref it builds (`ArgumentRef` vs
  `InputFieldRef`, `input.ts:125-170`); the option handling is identical (§7).

---

## 1. The general form: `t.arg({ type })`

`t.arg({...})` is `InputFieldBuilder.field(options)` — `fieldUtils/input.ts:122-173`:

```ts
field<Type extends InputType<Types> | [InputType<Types>], Req extends FieldRequiredness<Type>>(
  options: PothosSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind],
): InputOrArgRef<Types, InputShapeFromTypeParam<Types, Type, Req>, Kind>
```

- **`type` is required** in the general form (it's a required member of
  `InputFieldOptions`, `field-options.ts:259`). Everything else is optional.
- For `kind === 'Arg'` it builds an `ArgumentRef` whose config sets `kind`/
  `graphqlKind: 'Arg'`, `type` (via `inputTypeFromParam`), `description`,
  `deprecationReason`, `defaultValue`, `extensions`, `astNode`
  (`input.ts:125-148`).
- `type` accepts `InputType<Types>` or a one-element tuple `[InputType<Types>]`
  for a list (`input.ts:122`). So `t.arg({ type: [SomeInput] })` is a list arg
  in the general form. Using an **input object / enum** as the arg type is just
  passing that ref/name as `type` — the inputs page owns the details; mechanics
  are identical to any other input type (`inputTypeFromParam` resolves the ref,
  `utils/params.ts:105-115`, accepting `InputObject | Enum | Scalar`).

---

## 2. The scalar shorthands — the EXACT set

Defined as instance properties on `InputFieldBuilder`, each `= this.helper(<type>)`
(`fieldUtils/input.ts:28-82`). `helper` (`input.ts:175-188`) returns a function
that calls `field({ ...options, type })`, so a shorthand is just "`field` with
`type` pre-filled and omitted from the options" (`Omit<..., 'type'>`,
`input.ts:178`).

**Single-value scalar helpers (5):**

| helper | type baked in | source |
|---|---|---|
| `t.arg.boolean()` | `'Boolean'` | `input.ts:28` |
| `t.arg.float()`   | `'Float'`   | `input.ts:34` |
| `t.arg.id()`      | `'ID'`      | `input.ts:40` |
| `t.arg.int()`     | `'Int'`     | `input.ts:46` |
| `t.arg.string()`  | `'String'`  | `input.ts:52` |

**List helpers (5) — the `…List` forms DO exist:**

| helper | type baked in | source |
|---|---|---|
| `t.arg.booleanList()` | `['Boolean']` | `input.ts:58` |
| `t.arg.floatList()`   | `['Float']`   | `input.ts:64` |
| `t.arg.idList()`      | `['ID']`      | `input.ts:70` |
| `t.arg.intList()`     | `['Int']`     | `input.ts:76` |
| `t.arg.stringList()`  | `['String']`  | `input.ts:82` |

There are **no other** scalar helpers on the class (only these 10 + `field`,
`argBuilder`, `listRef`). Custom scalars/enums/input objects have **no**
shorthand — use the general form `t.arg({ type })` (§1).

- **`t.arg.listRef(type, { required? })`** also exists (`input.ts:89-96`): builds
  an `InputListRef` for a list whose *items* carry their own requiredness. Niche;
  the `…List` helpers cover the common case. Mention only if the page needs
  fine-grained list-item nullability.
- Each shorthand still takes the full options bag minus `type` (`input.ts:178`),
  so `t.arg.string({ required: true, description: '...' })` etc. all work.

---

## 3. Required vs optional — default is OPTIONAL (nullable)

### The `required` option

- `required?: Req` where `Req extends FieldRequiredness<Type>`
  (`field-options.ts:264-265`). `FieldRequiredness<Param>` is `boolean` for a
  scalar, or `boolean | { items: boolean; list: boolean }` for a list param
  (`type-params.ts:249-258`) — so a list arg can set item- and list-level
  nullability separately, e.g. `required: { list: true, items: false }`.

### Default requiredness = optional

- **[runtime]** When `required` is omitted, the arg's requiredness falls back to
  `this.builder.defaultInputFieldRequiredness` (`input.ts:139`, `:161`). That
  builder field defaults to **`false`**:
  `this.defaultInputFieldRequiredness = (options...).defaultInputFieldRequiredness ?? false`
  — `builder.ts:122-127`. `false` ⇒ not required ⇒ nullable in SDL.
- **[type-level]** `InputShapeFromTypeParam` (`type-params.ts:209-221`): with
  `required` omitted, `Required` defaults to the full `FieldRequiredness<Param>`
  union (the `Req` default on `InputFieldOptions`, `field-options.ts:256`), the
  branch `FieldRequiredness<Param> extends Required` is satisfied, and it returns
  `Types['DefaultInputFieldRequiredness'] extends false ? InputShape | null | undefined : InputShape`
  (`type-params.ts:215-218`). `DefaultInputFieldRequiredness` defaults to `false`
  (`types/schema-types.ts:29`; normalized default `false` at
  `types/global/schema-types.ts:18-20`, `:68`, `:91`), so the resolver sees
  `T | null | undefined`.
- **Confirmed by type-check** (isolated tsc run against `packages/core/src`):
  `t.arg.string()` ⇒ resolver arg `string | null | undefined`;
  `t.arg.int({ required: true, ... })` ⇒ `number`.
- This matches GraphQL's own rule: an argument with no `!` is nullable. Docs may
  say "Pothos follows GraphQL: arguments are optional/nullable unless you set
  `required: true`."

### `required: true` → NonNull

- **[runtime]** `required: true` ⇒ `inputTypeFromParam(..., true)` sets the field
  type `required: true` (`utils/params.ts:83`, `required = !!requiredOption`),
  which `build-cache.ts:298-299` turns into `new GraphQLNonNull(...)` (list case
  `:291-292`). So `required: true` is exactly the SDL `!`.
- **[type-level]** `Required extends true` branch of `InputShapeFromTypeParam`
  returns bare `InputShape<Types, Param>` (non-null) — `type-params.ts:219-220`.

### Interaction with `defaultInputFieldRequiredness`

- Passing `defaultInputFieldRequiredness: true` to `new SchemaBuilder({...})`
  flips the default: args/input-fields become **required unless `required: false`**.
  Runtime via the `?? defaultInputFieldRequiredness` fallback (`input.ts:139`);
  type via the `DefaultInputFieldRequiredness extends false ? ... : InputShape`
  else-branch (`type-params.ts:216-218`). An explicit `required` on the arg
  always wins over the default (it's the left side of `??` and of the type
  branch). This is the input-side analogue of `defaultFieldNullability` for
  output fields (`builder.ts:118-120`).

---

## 4. `defaultValue`

- **Option shape:** `defaultValue?: InputShapeFromTypeParam<Types, Type, Req>`
  (`field-options.ts:266-267`). Note it is typed against the arg's own shape and
  **does not change** the arg's type/nullability (it's a separate optional key).
- **[runtime]** It is copied straight onto the input-field config:
  `defaultValue: opts.defaultValue` (`input.ts:144` for Arg, `:166` for
  InputObject). `PothosInputFieldConfig extends Omit<GraphQLInputFieldConfig, 'type'>`
  (`types/configs.ts:149-171`), so `defaultValue` is a legitimate config key, and
  `buildInputFields` spreads the whole config into the emitted
  `GraphQLArgumentConfig`/`GraphQLInputFieldConfig` (`built[fieldName] = { ...config, type, extensions }`,
  `build-cache.ts:379-388`). **Pothos therefore hands `defaultValue` to graphql-js
  as the argument's default; it does not apply it itself at resolve time.**
- **Semantics (applied when omitted, NOT when null is passed):** this is
  graphql-js's coercion behavior — a default value is substituted when the client
  omits the argument, but an explicit `null` is passed through as `null`.
  **UNVERIFIED** in `packages/core` (standard graphql-js behavior; not asserted
  in this repo's source). The current docs page states this correctly (§8).
- **Interaction with `required`:** the two are orthogonal and combinable.
  - `defaultValue` alone leaves the arg nullable (type unchanged): resolver still
    sees `T | null | undefined` because `required` was not set (§3, and the
    type-level shape ignores `defaultValue`). Verified.
  - `required: true, defaultValue: x` ⇒ NonNull arg with a default; resolver sees
    bare `T`. graphql-js permits a default on a NonNull arg (the default lets the
    client omit it while the type still forbids explicit `null`). This is the
    "optional-with-a-sensible-default, nothing to narrow" pattern the page
    recommends. Verified at the type level (resolver sees `number` for
    `t.arg.int({ required: true, defaultValue: 25 })`).

---

## 5. How args arrive in the resolver

- **Second positional parameter.** `Resolver<Parent, Args, Context, Type, Return>`
  is `(parent, args, context, info) => ...` — `types/builder-options.ts:44-51`.
  The field's `resolve` uses `Resolver<ResolveShape, InputShapeFromFields<Args>, Types['Context'], ...>`
  (`types/global/field-options.ts:41-47`), so **`args` = `InputShapeFromFields<Args>`**.
- **Type derivation.** `Args` is the field's `args` map (`args?: Args` where
  `Args extends InputFieldMap`, `field-options.ts:56`, `:62-63`;
  `InputFieldMap = Record<string, GenericInputFieldRef<unknown>>`,
  `builder-options.ts:149`). The shape is computed by:
  ```ts
  export type InputShapeFromFields<Fields extends InputFieldMap> = NormalizeNullableFields<{
    [K in string & keyof Fields]: InputShapeFromField<Fields[K]>;
  }>;
  ```
  `builder-options.ts:245-247`. Each field's shape is read off the ref's phantom
  key: `InputShapeFromField` extracts `Field[inputFieldShapeKey]`
  (`builder-options.ts:261-265`), which on `ArgumentRef` is the `T` computed by
  `field()`'s return type `InputOrArgRef<..., InputShapeFromTypeParam<...>, 'Arg'>`
  (`input.ts:124`, `:172`; the key lives at `refs/arg.ts:13-15`). So each arg
  contributes `InputShapeFromTypeParam<Types, Type, Req>` (the §3 shape).
- **[runtime]** At build, each arg ref's config is materialized by
  `arg.getConfig(argName, fieldName, typeConfig)` and collected into the field's
  `args` map keyed by the object key (`fieldUtils/base.ts:46-55`). graphql-js then
  coerces incoming values and passes the resolved object as the resolver's 2nd arg.

---

## 6. Naming, description, deprecation, extensions on args

The full member list of `InputFieldOptions` (`field-options.ts:253-271`), all of
which an arg accepts (`ArgFieldOptions extends InputFieldOptions {}`, §7):

| option | type | source |
|---|---|---|
| `type` (required) | `InputType \| [InputType]` | `field-options.ts:259` |
| `description?` | `string` | `field-options.ts:260-261` |
| `deprecationReason?` | `string` | `field-options.ts:262-263` |
| `required?` | `FieldRequiredness<Type>` | `field-options.ts:264-265` |
| `defaultValue?` | `InputShapeFromTypeParam<...>` | `field-options.ts:266-267` |
| `extensions?` | `Readonly<Record<string, unknown>>` | `field-options.ts:268-269` |
| `astNode?` | `InputValueDefinitionNode` | `field-options.ts:270` |

- **There is NO `name` option on an arg.** The GraphQL argument name is the **key
  in the `args: { ... }` map** — set at build time from the object key
  (`base.ts:48`, `argName`). So args are not "renamed" via options; you rename by
  changing the key. (Contrast: object/input *type* refs have a `name` option; arg
  refs do not.) The page should say the arg name is the map key.
- `description` and `deprecationReason` are worth mentioning — both surface in
  SDL / introspection and are passed straight through (`input.ts:142-143`).
- `extensions` / `astNode` exist but are advanced; a fundamentals page can skip
  or footnote them.

---

## 7. Do args and input-object fields take the same options? YES.

This is the curriculum's honesty check ("input fields take the same options").
Verified:

- Both are produced by the **same** `InputFieldBuilder.field()` method, branching
  only on `kind` for which ref to create (`input.ts:122-173`); the option object
  is read identically for `description`, `deprecationReason`, `required`,
  `defaultValue`, `extensions`, `astNode` in both branches (`input.ts:141-147`
  Arg vs `:163-169` InputObject).
- The option **types** are literally the same interface:
  ```ts
  export interface ArgFieldOptions<...> extends InputFieldOptions<Types, Type, Req> {}          // :273-277
  export interface InputObjectFieldOptions<...> extends InputFieldOptions<Types, Type, Req> {}  // :279-283
  ```
  `field-options.ts:273-283` — **both are empty extensions of `InputFieldOptions`**,
  adding nothing. `InputFieldOptionsByKind` maps `Arg → ArgFieldOptions`,
  `InputObject → InputObjectFieldOptions` (`field-options.ts:285-292`).
- **Conclusion: the claim is HONEST.** In core, args and input-object fields
  accept an identical option set (`type`, `description`, `deprecationReason`,
  `required`, `defaultValue`, `extensions`, `astNode`), share the same
  requiredness/`defaultValue` semantics (§3, §4), and the same shape derivation
  (`InputShapeFromField`, §5). Teaching required/`defaultValue` once on the args
  page and having inputs refer back is accurate.
- **One honest caveat to preserve the claim's truth:** because `ArgFieldOptions`
  and `InputObjectFieldOptions` are *distinct* (empty) interfaces, a **plugin**
  can declaration-merge extra keys onto one but not the other (e.g. a
  validation/arg-only option). In core they are identical; "same options" is a
  core-level statement. Safe to phrase as "args and input fields take the same
  core options."

---

## 8. Inventory of the current page (`args.mdx`) — claim by claim

Line refs are into `website/content/docs/fundamentals/args.mdx` and the example
`website/playground-examples/fundamentals-args/schema.ts`.

| # | Claim | Verdict | Note |
|---|---|---|---|
| L8 | "Each entry is built with one of the `t.arg.*` helpers" | Imprecise | The general `t.arg({ type })` form is not a `t.arg.*` helper; L16 corrects this. Minor. |
| L12 | `args.raceId` is `string \| null \| undefined` | **CORRECT** | Optional scalar, default nullable (§3). Type-check confirmed. |
| L12 | `args.limit` is `number` | **CORRECT** | `required: true` scalar (§3). Confirmed. |
| L12 | `args.excludeIds` is **`readonly string[]`** | **WRONG** | Arg/input **list shapes are MUTABLE `string[]`**, not `readonly`. `InputShapeFromListTypeParam` returns `InputShape<...>[]` with **no** `readonly` (`type-params.ts:223-247`); `readonly` appears only on **output** shapes (`ShapeFromTypeParam`, `type-params.ts:177-194`). Confirmed by isolated tsc: `args.tags.push(...)` compiles and assigning a `readonly string[]` to the arg errors. |
| L16 | Scalar helpers `t.arg.string/int/id/boolean/float`; `…List` siblings; generic `t.arg({ type })` for non-scalars | **CORRECT** | Exactly the set in §2. |
| L33 | "GraphQL defaults arguments to nullable. Pothos follows that" | **CORRECT** | §3. |
| L35 | `t.arg.string()` → `string \| null \| undefined` | **CORRECT** | §3. |
| L36 | `t.arg.string({ required: true })` → `string` | **CORRECT** | §3. |
| L37 | `t.arg.string({ defaultValue: 'hello' })` → nullable, defaults when omitted, resolver still `string \| null \| undefined`, client may pass `null` | **CORRECT** | Type unchanged by `defaultValue` (§4); omitted-vs-null is graphql-js behavior (UNVERIFIED-in-repo but standard). |
| L38 | `t.arg.string({ required: true, defaultValue: 'hello' })` → `string` | **CORRECT** | §4. |
| L42-53 | Validate in resolver / throw; points to `plugin-validation` (Zod) | Plausible, out of scope | Not a core-source claim; `plugin-validation` existence not audited here. Flag only if the page must guarantee it. |
| L57-67 | Lift many args into an input object; `t.arg({ type: CharacterFilter })` | **CORRECT** | Mechanics per §1; inputs page owns detail. |
| example L41 | comment: "`required` flips the type from `(readonly string[] \| null \| undefined)` to `readonly string[]`" | **WRONG** | Same `readonly` error as L12. The flip in *nullability* is right; the `readonly` qualifier is not — arg lists are mutable `string[]` (v4 `ID` input shape is `string`, `types/schema-types.ts:59`). |

### The one substantive defect

**`readonly` on argument list types is incorrect** — it appears in `args.mdx:12`
and in the playground example comment (`fundamentals-args/schema.ts:41`).
Argument (and input-object) list values are typed as **mutable** `T[]`
(`type-params.ts:223-247` has no `readonly`; contrast the output-side
`ShapeFromTypeParam` at `:177-194` which does). Fix: drop `readonly` from both
(e.g. `args.excludeIds` is `string[]`). Everything else on the page is accurate.

---

## 9. Surprising / docs-relevant details

- **`t.arg` is one object that is both callable and a namespace** — the callable
  is `field`, the dotted helpers are copied prototype methods (§0). Users never
  see the machinery; they just call `t.arg(...)` or `t.arg.string(...)`.
- **Default requiredness is `false` (optional/nullable)** for args AND input
  fields, controlled by one builder option `defaultInputFieldRequiredness`
  (`builder.ts:122-127`) — the input analogue of `defaultFieldNullability`.
- **Arg name = the map key**, not an option (§6). No `name`/rename option exists
  on args.
- **`defaultValue` is delegated to graphql-js**, not applied by Pothos; it does
  not alter the resolver-facing type (§4).
- **Args and input-object fields share an identical core option set** (§7); the
  curriculum's "input fields take the same options" is honest at the core level,
  modulo plugin declaration-merging onto the distinct `ArgFieldOptions` /
  `InputObjectFieldOptions` interfaces.
- **Arg/input list shapes are mutable `T[]`, not `readonly`** — the only factual
  error on the current page (§8).
- **UNVERIFIED:** the "default applied on omit, not on explicit `null`" rule is
  graphql-js coercion behavior, not asserted in `packages/core` source.
