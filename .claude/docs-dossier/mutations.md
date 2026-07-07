# Dossier: The Mutation root (`mutationType`, `mutationField`, `mutationFields`)

Territory: everything a Mutations fundamentals page needs, from source only —
the `mutationType`/`mutationField`/`mutationFields` API and how exactly it
mirrors the Query API; the default name `Mutation` and renaming; the fact that
root mutation fields run **serially** (graphql-js executor behavior, not
Pothos); and a claim-by-claim audit of
`website/content/docs/fundamentals/mutations.mdx` — flagging the auth/narrowing
teaching that the curriculum moves to the Context page, and the return-convention
discrepancy with the subscriptions page's `addCharacter` example.

All line citations are into the worktree at
`.../scratchpad/pg-audit/packages/...` unless noted. Runtime methods live in
`packages/core/src/builder.ts`; options in
`packages/core/src/types/global/type-options.ts`. Page audited:
`website/content/docs/fundamentals/mutations.mdx`; example
`website/playground-examples/fundamentals-mutations/schema.ts`.

Convention: **[runtime]** = executed code changing the emitted schema;
**[type-level]** = affects only what TypeScript accepts. **UNVERIFIED** = not
asserted in `packages/core` source.

---

## 1. The three methods — exact mirror of the Query API

`builder.ts:271-316`:

```ts
mutationType(
  ...args: NormalizeArgs<
    [options: PothosSchemaTypes.MutationTypeOptions<Types>, fields?: MutationFieldsShape<Types>],
    0
  >
) {
  const [options = {}, fields] = args;
  this.mutationRef.updateConfig({
    kind: 'Mutation',
    graphqlKind: 'Object',
    name: options.name ?? 'Mutation',
    description: options.description,
    pothosOptions: options as unknown as PothosSchemaTypes.MutationTypeOptions,
    extensions: options.extensions,
    astNode: options.astNode,
  });
  this.configStore.addTypeRef(this.mutationRef);
  if (options.name) { this.mutationRef.name = options.name; }
  if (fields) { this.configStore.addFields(this.mutationRef, () => fields(new MutationFieldBuilder(this))); }
  if (options.fields) { this.configStore.addFields(this.mutationRef, () => options.fields!(new MutationFieldBuilder(this))); }
  return this.mutationRef;
}

mutationFields(fields: MutationFieldsShape<Types>) {
  this.configStore.addFields(this.mutationRef, () => fields(new MutationFieldBuilder(this)));
}

mutationField(name: string, field: MutationFieldThunk<Types>) {
  this.configStore.addFields(this.mutationRef, () => ({ [name]: field(new MutationFieldBuilder(this)) }));
}
```

This is the **same structure the query-roots dossier documented for
`queryType`/`queryField`/`queryFields`** (`builder.ts:226-269`). Verified
differences and parallels:

- **Single pre-created ref.** `private mutationRef = new MutationRef<Types>('Mutation')`
  at `builder.ts:79` (alongside `queryRef` `:78`, `subscriptionRef` `:80`). Every
  `mutation*` call operates on this one reused instance — the ref exists from
  construction but carries **no config** until `mutationType` runs.
- **`mutationType(options?, fields?)`** — `NormalizeArgs<[options, fields?], 0>`
  (`builder.ts:272-275`). Every `MutationTypeOptions` member is optional (§2), so
  `NormalizeArgs` makes the whole `options` arg optional ⇒ **`mutationType()` with
  no args is legal**, and **`mutationType({})` is idiomatic** (page L19). Defaulted
  by `const [options = {}, fields] = args` (`builder.ts:277`).
- **Two ways to pass fields** — positional `fields` (`builder.ts:295-297`) or
  `options.fields` (`builder.ts:299-303`); if both given, **both are added** (two
  separate `addFields`). Same as query.
- **`mutationFields(fields)`** — one callback returning a `FieldMap`
  (`builder.ts:308-310`). **`mutationField(name, field)`** — string name + a
  single-field thunk, wrapped into a one-key map (`builder.ts:312-316`).
- **All three route through `configStore.addFields(this.mutationRef, …)`**
  (`builder.ts:296,300,309,313`). *(Note one internal asymmetry vs query, no
  observable effect: `queryType` adds fields via `this.queryRef.addFields(...)`
  directly, whereas `mutationType` uses `this.configStore.addFields(...)` —
  `builder.ts:296` vs `:250`. Both defer-merge identically; the query-roots
  dossier §5 flagged the same.)*
- **Deferred merge, order-independent.** `configStore.addFields` runs the callback
  immediately if the ref has a config, else queues it until `addTypeRef` fires
  (`config-store.ts:48-64`, `:100-115`, `:191-199`). So `mutationField`/
  `mutationFields` work **before or after** `mutationType` — the same guarantee
  the query-roots dossier verified for queries.

### Return value & MutationRef

- `mutationType` returns the `MutationRef<Types>` (`builder.ts:305`).
  `MutationRef` is `class MutationRef<Types> extends ObjectRef<Types, Types['Root']>`
  (`refs/mutation.ts`), an ordinary object ref with parent shape `Types['Root']` —
  exactly parallel to `QueryRef` (`refs/query.ts:4`).

---

## 2. `MutationTypeOptions` — the exact option set (mirrors Query)

`type-options.ts:74-77`:

```ts
export interface MutationTypeOptions<Types extends SchemaTypes = SchemaTypes>
  extends RootTypeOptions<Types, 'Mutation'> {
  fields?: MutationFieldsShape<Types>;
}
```

`RootTypeOptions` (`type-options.ts:63-67`) extends `BaseTypeOptions`
(`type-options.ts:33-37`). Complete verified option set:

| option | type | source |
|---|---|---|
| `name?` | `string` | `type-options.ts:65` (`RootTypeOptions`) |
| `description?` | `string` | `type-options.ts:34` (`BaseTypeOptions`) |
| `extensions?` | `Readonly<Record<string, unknown>>` | `type-options.ts:35` |
| `astNode?` | `ObjectTypeDefinitionNode` | `type-options.ts:66` |
| `fields?` | `MutationFieldsShape<Types>` | `type-options.ts:76` |

Structurally identical to `QueryTypeOptions` (`type-options.ts:69-72`) — only the
`RootName` slot (`'Mutation'`) and the `fields` callback type differ. Like the
Query root, the Mutation root is built from `RootTypeOptions`, **not**
`ObjectTypeOptions`, so it has **no `isTypeOf` and no `interfaces`** options.

`MutationFieldsShape` hands the callback a `MutationFieldBuilder` (a
`RootFieldBuilder` specialized to `'Mutation'`/`'Object'`); its field methods
belong to the fields-anatomy dossier.

---

## 3. Default name `Mutation` and renaming

- **Default is `Mutation`.** `name: options.name ?? 'Mutation'` (`builder.ts:282`);
  the ref is even constructed `new MutationRef('Mutation')` (`builder.ts:79`).
- **Renameable via `options.name`.** When set, both the config name
  (`builder.ts:282`) and `this.mutationRef.name` (`builder.ts:291-293`) update, and
  `toSchema` reads the configured name back:
  `const mutationName = this.configStore.hasConfig(this.mutationRef) ?
  getTypeConfig(this.mutationRef).name : 'Mutation'` (`builder.ts:716-718`), then
  fed to `new GraphQLSchema({ query, mutation, subscription })` (`builder.ts:723-726`).
  Verified: `custom-root-names.ts:26-27` sets `mutationType({ name:
  'CustomMutation' })`.
- **No `mutationType` ⇒ no mutation root.** With no config, `hasConfig` is false
  (`config-store.ts:209-217`), the name falls back to `'Mutation'`, and
  `buildCache.types.get('Mutation')` is `undefined` unless some type is literally
  named `Mutation`; the schema is built with `mutation: undefined`. Corollary:
  calling only `mutationField`/`mutationFields` without `mutationType` leaves the
  callbacks pending and creates **no** Mutation type — mirrors the query-roots
  dossier finding. (graphql-js does NOT require a mutation root, unlike query.)

### "Runs exactly once" — is it enforced?

The page says (L16) "Like `queryType`, `mutationType` runs exactly once per
schema." **This is a convention, not an enforced constraint.** Calling
`mutationType` twice does **not** throw: `addTypeRef` early-returns on the reused
ref (`config-store.ts:135-138`), a second call re-runs `updateConfig`
(overwriting name/description/extensions/astNode) and **appends** any new fields.
The only hard failure is a duplicate **field name** across calls
(`Duplicate field ${fieldName} on ${config.name}`, `config-store.ts:176-178`).
So "once" is the intended usage, but the runtime tolerates repeats — phrase as
guidance, not a rule.

---

## 4. Root mutation fields execute SERIALLY — graphql-js, not Pothos (ledger F6)

**This behavior is graphql-js's executor, not Pothos.** Pothos emits an ordinary
`GraphQLObjectType` for the Mutation root (`graphqlKind: 'Object'`,
`builder.ts:281`); nothing in `packages/core` sequences resolvers. The serial
execution of top-level mutation fields is implemented in graphql-js:

- graphql version here is **17.0.1** (`node_modules/graphql/package.json`).
- In the executor, root fields run serially **iff the operation is a mutation**:
  `serially ?? operationType === ast.OperationTypeNode.MUTATION`
  (`node_modules/graphql/execution/Executor.js:119`), which dispatches
  `executeRootGroupedFieldSet(..., serially, ...)` (`Executor.js:190`) to
  `this.executeFieldsSerially(...)` when `serially` is true (`Executor.js:191-195`).
  Query/subscription root fields go through the parallel path.
- **Attribution for the page:** "Top-level mutation fields execute in series (one
  finishes before the next starts); this is the GraphQL spec / graphql-js
  executor behavior, not something Pothos adds." **UNVERIFIED in `packages/core`**
  — it is asserted only in graphql-js source, cited above. (Nested/child fields
  under each mutation still resolve in parallel as usual.)

---

## 5. Inventory of the current page (`mutations.mdx`) — claim by claim

Line refs into `website/content/docs/fundamentals/mutations.mdx` and
`website/playground-examples/fundamentals-mutations/schema.ts`.

| # | Claim | Verdict | Note |
|---|---|---|---|
| L8 | "The API mirrors Queries — `mutationType`, `mutationField`, `mutationFields`" | **CORRECT** | §1 — exact structural mirror. |
| L8 | "Mutations are queries that change state" | Convention/spec framing | True in spirit; the mechanical difference that IS real is serial execution (§4), which the page does not currently mention. |
| L16 | "Like `queryType`, `mutationType` runs exactly once per schema" | **Imprecise** | Convention, not enforced — repeats don't throw, they append/overwrite (§3). Reword to "call it once" as guidance. |
| L19 | `builder.mutationType({});` | **CORRECT** | Idiomatic empty-open form (§1; `NormalizeArgs` makes options optional). |
| L25-31 | `builder.mutationField('addCharacter', (t) => t.field({ type: Character, args: { input: t.arg({ type: AddCharacterInput, required: true }) }, resolve }))` | **CORRECT** | Matches `mutationField(name, thunk)` signature (`builder.ts:312-316`). |
| L34 | "choice between `mutationField` and `mutationFields` … same call as for queries" | **CORRECT** | §1 — identical to query variants. |
| L38-49 | Auth **narrowing** teaching: `if (!ctx.user) throw` lift, row-level ownership check, fold existence+ownership | Out of scope per curriculum | Not a core-source claim (resolver logic). **Curriculum moves narrowing to Context.** The page itself already defers the lift to `./context#narrowing-inside-a-resolver` (L38) — but still re-teaches it at length (L38-51). The draft should slim §"Authorization by hand": keep the *row-level* permission point (unique to mutations) and cut the generic `ctx.user` narrowing re-explanation, linking to Context instead. |
| L53-56 | "Return the entity the mutation changed, so the client can re-read fields" | **CORRECT / convention** | The example returns `Character` (`schema.ts:44,69`). Sound GraphQL convention; not a core constraint. |
| L57-64 | GraphQL sample selecting `id`, `biography` on `updateCharacter` | **CORRECT** | Matches the exposed fields (`schema.ts:26-29`). |
| L66 | "wrap the result in a small payload type … `DeleteCharactersPayload { success, deletedCount }` reads better than `Boolean!`" | **CORRECT / convention** | Reasonable guidance; no core mechanism involved. |
| L68-76 | Plugins (`plugin-scope-auth`, `plugin-errors`, `plugin-validation`) | Out of scope | Plugin behavior not audited here; existence/claims not verified against those packages. Flag only if the page must guarantee specifics. |
| schema.ts L47-55 | Inline `t.arg({ type: builder.inputType('UpdateCharacterInput', {...}), required: true })` | **CORRECT** | Inline input as arg type — inputs page owns the teaching (§6). |

**No factual errors in core-API claims.** The one wording fix is L16 ("runs
exactly once" → convention). The one editorial action is the narrowing overlap
(L38-51) the curriculum wants trimmed toward Context.

---

## 6. What the page says about input types (inputs page owns this)

- The mutation example takes its values through an inline `inputType`
  (`schema.ts:47-55`, `UpdateCharacterInput` with `characterId: t.id({ required:
  true })`, `biography: t.string({ required: true })`) passed as a `required: true`
  arg. The page prose (L8, L12) describes this as "an input object" that "groups
  the mutation's values into one named type."
- **All input mechanics — `inputType`, field builder, `required`/`defaultValue`,
  nesting, recursion — belong to the inputs dossier/page.** The mutations page
  should reference inputs, not re-teach them. Currently it only names the concept,
  which is correct scoping. The Callout (L89-91 of the inputs page) already
  cross-links Mutations ↔ Inputs.

---

## 7. Return-convention discrepancy with the subscriptions page

The task's specific check: does the mutations page's payload/return convention
match the subscriptions page's `addCharacter` example?

- **Mutations page teaches:** return the changed **entity** (`Character`), and
  says a bare `Boolean!` is worse than a payload type (L53-66).
- **Subscriptions page's `addCharacter` returns bare `Boolean!`:**
  `builder.mutationField('addCharacter', (t) => t.boolean({ args: { name },
  resolve: (_root, { name }, ctx) => { ctx.pubSub.publish('CHARACTER_ADDED', {
  name }); return true; } }))` (`website/content/docs/fundamentals/subscriptions.mdx:23-31`).
- **This is a real, mild discrepancy in convention** — the subscriptions example
  is a fire-and-publish mutation whose only job is to emit an event, so `Boolean!`
  is defensible there; but it is exactly the return shape the mutations page
  discourages. **Note for the drafts:** either (a) let the subscriptions example
  return the created `Character` to stay consistent, or (b) add a one-line
  acknowledgement that fire-and-notify mutations are the exception to the
  "return the entity" rule. Not a bug — a cross-page consistency flag.

---

## 8. Surprising / docs-relevant details

- **Serial execution of root mutation fields is graphql-js's, not Pothos's**
  (`Executor.js:119,190-195`, graphql 17.0.1) — the page doesn't currently
  mention it, and it is the one genuinely mutation-specific runtime fact
  (ledger F6). **UNVERIFIED in `packages/core`.**
- **`mutationType` "once" is convention, not enforced** — repeats append/overwrite
  rather than throw (§3, `config-store.ts:135-138,176-178`).
- **The Mutation root is an ordinary Object built from `RootTypeOptions`** — no
  `isTypeOf`/`interfaces` options; default name `Mutation`, renameable via
  `name` (§2, §3).
- **No mutation root is required** by graphql-js (unlike the query root) — omitting
  `mutationType` yields `mutation: undefined` (§3).
- **Return-convention mismatch** between the mutations page (return the entity)
  and the subscriptions page's `Boolean!` `addCharacter` (§7).
- **Narrowing teaching overlaps Context** — the curriculum moves it there; the
  page should link, not re-derive (§5, L38-51).
