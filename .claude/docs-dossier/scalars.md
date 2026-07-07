# Dossier: Scalars (fundamentals)

Territory: declaring custom scalars on the `Scalars` builder-generic entry (Input/Output shapes)
and the relationship to `builder.scalarType(name, options)`; which `serialize`/`parseValue`/
`parseLiteral` options are required vs optional and **who calls them** (graphql-js, F6
attribution); `builder.addScalarType` for reusing existing `GraphQLScalarType` instances
(graphql-scalars interop); the built-in scalars and their default TS shapes (including ID's
asymmetric Input/Output shape); the **graphql 17 scalar coercion hooks** this repo recently added;
and a claim-by-claim inventory of `website/content/docs/fundamentals/scalars.mdx`.

All paths relative to the worktree root (`…/pg-audit/`). Citations are
`packages/core/src/<file>:<line>` unless noted as a test/example/website path. Every line cited
was read.

---

## 1. Declaring a custom scalar — the `Scalars` generic entry

- The builder generic's `Scalars` maps each scalar name to `{ Input; Output }`
  (`types/global/schema-types.ts:56-61`, `UserSchemaTypes.Scalars`). A user adds an entry via
  `new SchemaBuilder<{ Scalars: { DateTime: { Input: Date; Output: Date } } }>({})`; it is merged
  onto the built-in five by `MergedScalars` (`types/global/schema-types.ts:75` →
  `types/schema-types.ts:35-47`).
- The generic **declares types only**; the runtime implementation must be supplied separately by
  `scalarType`/`addScalarType`, and a scalar name that has a generic entry but no implementation
  gets no `GraphQLScalarType` — see §5 built-in auto-registration for the built-ins' escape hatch.
- `ScalarName<Types> = string & (BaseScalarNames | keyof Types['Scalars'])`
  (`types/schema-types.ts:73-76`) — the name passed to `scalarType`/`addScalarType`/`type:` is
  constrained to a declared (or built-in) scalar name.

## 2. `builder.scalarType(name, options)` — signature & required/optional options

- Signature (`builder.ts:545-552`):
  ```ts
  scalarType<Name extends ScalarName<Types>>(
    name: Name,
    options: PothosSchemaTypes.ScalarTypeOptions<Types, InputShape<Types, Name>, ParentShape<Types, Name>>,
  ): PothosSchemaTypes.ScalarRef<Types, InputShape<Types, Name>, ParentShape<Types, Name>>
  ```
  The Input shape and the (parent/output) shape are pulled from the `Scalars` generic by `Name`
  (`builder.ts:548-551`) — this is how "the generic and the implementation have to agree" is
  enforced at the type level. Returns a `ScalarRef<Types, Output, Input, Parent>`
  (`refs/scalar.ts:11-30`) implementing both `OutputRef` and `InputRef` (`:13`).
- `ScalarTypeOptions` (`types/global/type-options.ts:129-153`) extends `BaseTypeOptions`
  (`description?`/`extensions?`/`astNode?`) and — importantly — **every field is optional in the
  type**:
  - `serialize?: (outputValue) => unknown` (`:136`) — the source comment (`:134-135`) states it is
    **"Required unless the graphql 17+ `coerceOutputValue` is provided instead — one of the two
    must be set for output to serialize."** So *practically required* for output, but the compiler
    does not force it (the graphql-17 hook can substitute).
  - `parseValue?: GraphQLScalarValueParser<ScalarInputShape>` (`:138`) — optional; needed to accept
    the scalar as **variable input**.
  - `parseLiteral?: GraphQLScalarLiteralParser<ScalarInputShape>` (`:140`) — optional; needed to
    accept the scalar as an **inline literal** in a query.
  - graphql-17 hooks `coerceOutputValue?` / `coerceInputValue?` / `coerceInputLiteral?` /
    `valueToLiteral?` (`:146-151`) — see §4.
  - `astNode?: ScalarTypeDefinitionNode` (`:152`).
- Runtime wiring (`builder.ts:553-581`): builds a `ScalarRef` whose config copies
  `serialize`/`parseValue`/`parseLiteral` straight through (`:558-560`) and **conditionally
  spreads** the four graphql-17 keys only when present (`:563-572`) so graphql 16's narrower
  `GraphQLScalarTypeConfig` isn't tripped (comment `:561-562`). The config is
  `PothosScalarTypeConfig extends GraphQLScalarTypeConfig` (`types/configs.ts:85-89`).

## 3. Who calls serialize / parseValue / parseLiteral (F6 attribution)

Pothos does **not** call these itself — it only passes them into a graphql-js `GraphQLScalarType`
(`buildScalar`, `build-cache.ts:705-712`). **graphql-js's execution/coercion machinery** invokes
them:
- **`serialize`** — called by graphql-js when producing a **response**: maps the internal/resolver
  value → the JSON wire value (output).
- **`parseValue`** — called by graphql-js for a value arriving via **variables**: wire value →
  internal `Input` shape.
- **`parseLiteral`** — called by graphql-js for a value written as an **inline literal** in the
  query AST: literal node → internal `Input` shape.

So docs prose like "Pothos has already parsed the ISO string" is *mechanically* graphql-js calling
the `parseValue`/`parseLiteral` that Pothos wired in — attribute the parsing step to graphql-js,
with Pothos supplying the functions (see §6 inventory L49).

## 4. graphql 17 scalar coercion hooks (recently added in this repo)

`ScalarTypeOptions` (`types/global/type-options.ts:141-151`) adds four graphql-17-only hooks; the
source comments are the authoritative doc:
- `coerceOutputValue?` (`:146`) — output equivalent of `serialize`. When both `serialize` and
  `coerceOutputValue` are set, **graphql uses `serialize`** (comment `:144-145`).
- `coerceInputValue?` (`:147`) — input from variables (parallel to `parseValue`).
- `coerceInputLiteral?` (`:148`) — receives a **const value node with variables already replaced**;
  graphql **requires it to be paired with `coerceInputValue`** or it throws at schema build
  (comment `:142-144`).
- `valueToLiteral?` (`:149-151`) — converts an external value to a const literal; used by graphql
  17+ when **printing default values** for the scalar (without it, custom-scalar defaults fall
  back to a generic conversion).
- These are **only consulted on graphql 17+**; on graphql 16 use the classic trio (which keeps
  working on 17). They are conditionally spread in `scalarType` (`builder.ts:563-572`) precisely so
  graphql 16's config type isn't broken.
- **Proof + version-gating** in `tests/scalar-coercion.test.ts`: it wires all four hooks and
  branches on `versionInfo.major >= 17` (`:46`, `:77`). On 17+, inline literal → `coerceInputLiteral`
  and variable → `coerceInputValue` fire (`:47-50`); a scalar with **only** `coerceOutputValue`
  (no `serialize`) serializes via the hook on 17 but **falls back to identity on 16** (`:57-83`).
  This confirms `serialize` is not compile-required and the hooks are genuinely version-dependent.

**Docs impact:** the fundamentals page (§6) never mentions these hooks, so there is no incorrect
claim to fix — but any statement that `serialize` is *strictly required* would now be false
(`:134-136`). Keep the page's classic trio (portable across 16 and 17); only introduce the hooks
in an advanced/graphql-17 note.

## 5. `builder.addScalarType` + built-in scalars

- **`addScalarType(name, scalar, options?)`** (`builder.ts:583-616`): reuse an existing
  `GraphQLScalarType`. It calls `scalar.toConfig()` (`:602`) and spreads that config + optional
  overrides into `scalarType` (`:604-615`), merging `extensions` (`:607-610`). The one difference
  from `scalarType`'s options is that **`serialize` is `Omit`ted then re-added as optional**
  (`:588-597`) since the instance already carries one. This is the graphql-scalars interop path.
- **Built-in scalars** `ID/Int/Float/String/Boolean` are auto-registered in `toSchema`
  (`builder.ts:697-703`): for each of `[GraphQLID, GraphQLInt, GraphQLFloat, GraphQLString,
  GraphQLBoolean]`, if no implementation exists yet, `addScalarType(scalar.name, scalar)` is called.
  In `buildScalar` those five names **return the graphql-js singletons directly** (bypassing
  `new GraphQLScalarType`) — `build-cache.ts:684-703`. `BuiltinScalarRef`
  (`refs/builtin-scalar.ts:5-13`) is the ref subtype that carries a prebuilt `GraphQLScalarType`.
- **Default TS shapes** (`types/schema-types.ts:57-63`, `DefaultScalars`, v4 default):
  - `String: { Input: string; Output: string }`
  - **`ID: { Input: string; Output: bigint | number | string }`** — **asymmetric**: inputs arrive
    as `string`, but a resolver may return `bigint | number | string`. This is the one built-in
    with a genuinely different Input vs Output shape.
  - `Int: { Input: number; Output: number }`, `Float: { number; number }`,
    `Boolean: { boolean; boolean }`.
  - The `v3` defaults differ only for `ID: { Input: number | string; Output: number | string }`
    (`types/schema-types.ts:65-71`) — selected when `Defaults: 'v3'`.

---

## 6. Inventory of `website/content/docs/fundamentals/scalars.mdx`

Line refs into the mdx.

- **L8** "GraphQL ships with five built-in scalars — `ID`, `String`, `Int`, `Float`, `Boolean` —
  and Pothos exposes each through `t.exposeID`, `t.exposeString`, … or scalar field builders like
  `t.int({ … })`." **TRUE.** The five are auto-registered (`builder.ts:697-703`) and returned as
  graphql-js singletons (`build-cache.ts:685-703`). (`exposeX`/`t.int` are field-builder helpers —
  fields territory; correct that they exist.)
- **L10** includes region `datetime-scalar` of
  `website/playground-examples/fundamentals-scalars/schema.ts`. **Region EXISTS & is coherent**:
  the `#region datetime-scalar` block declares `Scalars: { DateTime: { Input: Date; Output: Date }
  }` then `builder.scalarType('DateTime', { serialize: v => v.toISOString(), parseValue: … Date })`
  — a valid custom scalar (§1, §2). ✔
- **L12** "`Scalars` on the builder generic declares the name and the Input/Output shapes … 
  `scalarType` provides the runtime implementation. Both have to agree." **TRUE** — the generic
  supplies `InputShape`/`ParentShape` to `scalarType`'s options and return
  (`builder.ts:548-551`), enforcing agreement at the type level (§1-2).
- **L14-27** "Input vs Output": Output `Date` (resolvers return `Date`), Input `Date` (resolvers
  receive `Date` after `parseValue`). **TRUE** for `DateTime` (`ScalarOutputShape`/
  `ScalarInputShape`, `types/global/type-options.ts:129-138`).
  - **L21-27 WEAK/INCOHERENT EXAMPLE:** the prose promises the "when the shapes **don't** match …
    split them" case — "a custom `PositiveInt` that accepts a string and emits a number" — but the
    code shows `PositiveInt: { Input: number; Output: number }`, i.e. **both `number`** (they
    *match*). So the section meant to demonstrate an **asymmetric** scalar shows a **symmetric**
    one; neither this nor the `DateTime` (`Date`/`Date`) example ever exhibits `Input ≠ Output`.
    The one true built-in asymmetry is **`ID`** (`{ Input: string; Output: bigint | number |
    string }`, `types/schema-types.ts:59`) — cite/use that if the page wants a real example. Not a
    factual falsehood about the API, but the illustration contradicts its own framing.
- **L29-49** "Using the scalar" — by name `'DateTime'` on a field/arg, and note `after` is
  `Date | null | undefined`. **TRUE** (`ScalarRef` is both output+input ref, §2).
  - **L49 attribution nuance:** "Pothos has already parsed the ISO string the client sent." The
    parse is performed by **graphql-js** invoking the `parseValue` Pothos wired in
    (`build-cache.ts:705-712`, §3) — not Pothos parsing at runtime. Minor; reword to "graphql-js
    has parsed the ISO string via your `parseValue`" for a precise F6 attribution.
- **L51-67** "graphql-scalars" via `builder.addScalarType('DateTime', DateTimeResolver)`. **TRUE**
  — `addScalarType` accepts a `GraphQLScalarType`, `toConfig()`s it, and forwards to `scalarType`
  (`builder.ts:583-616`, §5). The `Scalars: { DateTime: { Input: Date; Output: Date } }` generic
  paired with `DateTimeResolver` is the correct interop shape.
- **L69-71** Callout cross-links (Fields, graphql-scalars catalog) — fine.

**WRONG claims found in scalars.mdx:** **no outright-false API claim.** Two precision defects: (1)
L21-27 presents a **symmetric** `{ Input: number; Output: number }` scalar as the example of
**asymmetric** shapes — self-contradicting illustration; the real asymmetric case is `ID`. (2) L49
attributes parsing to Pothos when graphql-js performs it via the wired-in `parseValue` (F6). The
page also silently relies on `serialize` being "required," which is now only *practically* true —
graphql 17's `coerceOutputValue` can substitute (§4) — but since the page never claims strict
requirement, this is a note, not an error.

---

## 7. Docs-writing guidance (grounded)

- To actually demonstrate `Input ≠ Output`, use **`ID`** (`types/schema-types.ts:59`) or a scalar
  whose parsed shape differs from its serialized shape; the current `PositiveInt`/`DateTime`
  examples are both symmetric (§6 L21-27).
- Attribute serialize/parseValue/parseLiteral to **graphql-js** calling the functions Pothos wired
  in (§3); Pothos's job is the `Scalars` generic ↔ `scalarType` type-safe binding.
- Keep the fundamentals page on the classic trio; put the graphql-17 coercion hooks (§4) in an
  advanced note, and never say `serialize` is unconditionally required (`type-options.ts:134-136`).
- For "reuse an existing scalar," `addScalarType` (§5) is the intended path — pair it with a
  matching `Scalars` generic entry, as L58-65 correctly does.

## 8. UNRESOLVED / UNVERIFIED

- **UNVERIFIED (behavioral):** the exact graphql-js build-time error when `coerceInputLiteral` is
  set without `coerceInputValue` (comment asserts it throws, `type-options.ts:142-144`); confirmed
  only via the source comment, not by running a failing build on graphql 17.
- **NOTE:** `scalar-coercion.test.ts` branches on `versionInfo.major` (`:46`, `:77`); the installed
  graphql major in this worktree was **not** checked, so which branch actually executes here is
  unverified (the wiring in `scalarType`/`ScalarTypeOptions` is version-agnostic regardless).
