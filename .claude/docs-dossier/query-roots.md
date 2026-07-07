# Dossier: The Query root type (`queryType`, `queryField`, `queryFields`)

Territory: everything a docs page on the Query root needs, from source only —
`builder.queryType()`, `builder.queryField()`, `builder.queryFields()`; their
exact signatures and options; the merge/ordering mechanism; root type naming;
and the parallel mutation/subscription APIs (confirmed only, not detailed here).

All line citations are into the worktree at
`.../scratchpad/pg-audit/packages/...`. Runtime methods live in
`packages/core/src/builder.ts`; option types in
`packages/core/src/types/global/type-options.ts`.

Convention: **[runtime]** = executed code that changes the emitted schema;
**[type-level]** = affects only what TypeScript accepts.

---

## 0. Where the public API actually comes from

- The runtime class is `export class SchemaBuilder<Types extends SchemaTypes>`
  at `builder.ts:75`. The public, user-facing interface
  `PothosSchemaTypes.SchemaBuilder<Types>` is declared as
  `extends Builder<Types>` and adds nothing:
  `export interface SchemaBuilder<Types extends SchemaTypes> extends Builder<Types> {}`
  at `packages/core/src/types/global/classes.ts:31`. **Consequence: the method
  signatures users see for `queryType`/`queryField`/`queryFields` are exactly the
  runtime class signatures in `builder.ts`** — there is no separate declared
  overload set to reconcile.

- Three private root refs are created once, eagerly, in the class body — not in
  the constructor and not per call:
  - `private queryRef = new QueryRef<Types>('Query')` — `builder.ts:78`
  - `private mutationRef = new MutationRef<Types>('Mutation')` — `builder.ts:79`
  - `private subscriptionRef = new SubscriptionRef<Types>('Subscription')` — `builder.ts:80`

  `QueryRef` is `class QueryRef<Types> extends ObjectRef<Types, Types['Root']> {}`
  (`packages/core/src/refs/query.ts:4`), so the Query root is an ordinary object
  ref whose parent shape is `Types['Root']`. These refs exist from construction,
  but they carry **no config** until `queryType()` runs (see §1, §5).

---

## 1. `builder.queryType(options?, fields?)`

Runtime definition — `builder.ts:226-259`:

```ts
queryType(
  ...args: NormalizeArgs<
    [options: PothosSchemaTypes.QueryTypeOptions<Types>, fields?: QueryFieldsShape<Types>],
    0
  >
): QueryRef<Types> {
  const [options = {}, fields] = args;

  this.queryRef.updateConfig({
    kind: 'Query',
    graphqlKind: 'Object',
    name: options.name ?? 'Query',
    description: options.description,
    pothosOptions: options as unknown as PothosSchemaTypes.QueryTypeOptions,
    extensions: options.extensions,
    astNode: options.astNode,
  });

  if (options.name) {
    this.queryRef.name = options.name;
  }

  this.configStore.addTypeRef(this.queryRef);

  if (fields) {
    this.queryRef.addFields(() => fields(new QueryFieldBuilder(this)));
  }

  if (options.fields) {
    this.queryRef.addFields(() => options.fields!(new QueryFieldBuilder(this)));
  }

  return this.queryRef;
}
```

Facts:

- **Signature / arity.** Uses `NormalizeArgs<[options, fields?], 0>`
  (`builder.ts:227-230`; `NormalizeArgs` def `packages/core/src/types/utils.ts:120-132`).
  Because every property of `QueryTypeOptions` is optional (§2), `NormalizeArgs`
  makes the whole `options` argument optional, so **`builder.queryType()` with no
  args is legal** — verified in use: `builder.queryType();` at
  `packages/core/tests/examples/giraffes/index.ts:9`. The defaulting
  `const [options = {}, fields] = args` (`builder.ts:232`) supplies `{}` when
  omitted.
- **Two ways to pass fields.** Fields may be given either as a positional second
  argument (`fields`, `builder.ts:250-252`) or as `options.fields`
  (`builder.ts:254-256`). If both are given, **both are added** — they are two
  separate `addFields` calls, not one overriding the other. Docs examples use the
  `options.fields` form: `starwars/schema/query.ts:12-37`,
  `custom-root-names.ts:5-24`.
- **Return value.** Returns the `QueryRef<Types>` (`builder.ts:231`, `:258`).
- **What it writes** [runtime]: sets the query type's config via
  `queryRef.updateConfig({...})` (`builder.ts:234-242`) with `kind: 'Query'`,
  `graphqlKind: 'Object'`, name, description, extensions, astNode; then registers
  the ref with the config store via `this.configStore.addTypeRef(this.queryRef)`
  (`builder.ts:248`). Registration is what makes the type real (see §5).
- **Options that apply** (§2 has the full type): `name`, `description`,
  `extensions`, `astNode`, `fields`. Note the config object at `builder.ts:234-242`
  reads exactly these five (`options.name`, `.description`, `.extensions`,
  `.astNode`, `.fields`) plus the whole `options` bag stored as `pothosOptions`
  (`builder.ts:239`) so plugins can read their own added keys.

### Can `queryType` be called more than once?

- **Yes, it does not throw for the query ref itself.** `addTypeRef` early-returns
  on a ref it has already seen: `if (this.refs.has(ref)) return;`
  (`config-store.ts:135-138`). Since the same `queryRef` instance is reused
  (`builder.ts:78`), a second `queryType()` call skips re-registration.
- A second call still runs `queryRef.updateConfig(...)` again (`builder.ts:234`),
  so **name/description/extensions/astNode from the later call overwrite the
  earlier config** (`updateConfig` replaces `currentConfig` wholesale,
  `packages/core/src/refs/base.ts:56-73`), and any `fields` from the later call
  are **appended** (another `addFields`, `builder.ts:250-256`).
- Caveat: appended fields go through the config store's duplicate-field guard.
  If two `queryType`/`queryField`/`queryFields` calls define the **same field
  name**, build throws `Duplicate field ${fieldName} on ${config.name}`
  (`config-store.ts:176-178`). So "call twice" is fine as long as field names
  don't collide.
- The generic "another type already has this name" guard
  (`Duplicate typename: Another type with name ${config.name} already exists.`,
  `config-store.ts:149-153`) only fires if a *different* ref claims the name
  `Query` — e.g. an `objectRef('Query')` you also register (see §4 note on
  `custom-root-names.ts`, which avoids this by renaming the root).

### What if `queryType` is never called?

- The `queryRef` never gets a config (no `updateConfig`) and is never registered
  (no `addTypeRef`). In `toSchema` the query type name resolves via
  `this.configStore.hasConfig(this.queryRef) ? getTypeConfig(...).name : 'Query'`
  (`builder.ts:713-715`); with no config `hasConfig` returns `false`
  (`config-store.ts:209-217`), so it falls back to the string `'Query'`, then
  `buildCache.types.get('Query')` (`builder.ts:724`) yields **`undefined`** unless
  some type literally named `Query` was built. The `GraphQLSchema` is then
  constructed with `query: undefined` (`builder.ts:723-724`).
- **UNVERIFIED (graphql-js behavior, not this repo):** graphql-js throwing on a
  schema with no query root ("Query root type must be provided.") is standard
  graphql behavior but is not asserted anywhere in `packages/core` source I read.
  What *is* verified from source: Pothos does not itself throw or synthesize an
  empty Query — with no `queryType` and no query fields, `query` is `undefined`.
- Corollary: calling only `queryField`/`queryFields` **without** `queryType` does
  **not** create the Query type (the field callbacks stay pending forever, see §3)
  — every working example pairs the field calls with a `queryType()` call
  (`giraffes/index.ts:9`).

---

## 2. `QueryTypeOptions` — the exact option set

Type chain (`packages/core/src/types/global/type-options.ts`):

```ts
export interface BaseTypeOptions<Types> {           // :33-37
  description?: string;
  extensions?: Readonly<Record<string, unknown>>;
  astNode?: TypeDefinitionNode;
}

export interface RootTypeOptions<Types, Type extends RootName>   // :63-67
  extends BaseTypeOptions<Types> {
  name?: string;
  astNode?: ObjectTypeDefinitionNode;
}

export interface QueryTypeOptions<Types = SchemaTypes>           // :69-72
  extends RootTypeOptions<Types, 'Query'> {
  fields?: QueryFieldsShape<Types>;
}
```

So the **complete, verified option set for `queryType`** is:

| option | type | source |
|---|---|---|
| `name?` | `string` | `type-options.ts:65` (`RootTypeOptions`) |
| `description?` | `string` | `type-options.ts:34` (`BaseTypeOptions`) |
| `extensions?` | `Readonly<Record<string, unknown>>` | `type-options.ts:35` |
| `astNode?` | `ObjectTypeDefinitionNode` | `type-options.ts:66` (narrows the `BaseTypeOptions` `TypeDefinitionNode`) |
| `fields?` | `QueryFieldsShape<Types>` | `type-options.ts:71` |

- **Which object-type options do NOT apply to the Query root.** The Query root is
  built from `RootTypeOptions`, **not** `ObjectTypeOptions`. Comparing to
  `ObjectTypeOptions` (`type-options.ts:46-52`), the root type has **no**
  `isTypeOf` (`:51`) and **no** `interfaces` (`:49`, and the
  `ObjectTypeWithInterfaceOptions` variant `:54-62`). Root types therefore cannot
  declare `isTypeOf` or implement interfaces through `queryType` options — they
  are not part of `RootTypeOptions`/`QueryTypeOptions`. (Fields on the root ref
  *can* still be given interfaces at the ref level via internal `addInterfaces`,
  but there is no `queryType` option surface for it.)
- Every property is optional, which is why `queryType()` type-checks with no args
  (§1).

`QueryFieldsShape` (the `fields` callback type),
`packages/core/src/types/builder-options.ts:115-117`:

```ts
export type QueryFieldsShape<Types> = (
  t: PothosSchemaTypes.QueryFieldBuilder<Types, Types['Root']>,
) => FieldMap;
```

`FieldMap = Record<string, GenericFieldRef<unknown>>` — `builder-options.ts:147`.
The field builder handed in is `QueryFieldBuilder`
(`packages/core/src/fieldUtils/query.ts:4-12`), a `RootFieldBuilder` specialized
to `'Query'` / `'Object'` (constructed `super(builder, 'Query', 'Object')`,
`query.ts:10`). Details of the field builder's methods belong to the
fields-anatomy dossier.

---

## 3. `queryField(name, fieldFn)` and `queryFields(fieldsFn)`

Runtime definitions — `builder.ts:261-269`:

```ts
queryFields(fields: QueryFieldsShape<Types>) {
  this.configStore.addFields(this.queryRef, () => fields(new QueryFieldBuilder(this)));
}

queryField(name: string, field: QueryFieldThunk<Types>) {
  this.configStore.addFields(this.queryRef, () => ({
    [name]: field(new QueryFieldBuilder(this)),
  }));
}
```

- **`queryFields(fieldsFn)`** — one arg: a `QueryFieldsShape<Types>` callback
  returning a `FieldMap` (object of many fields). `builder.ts:261`. Example:
  `starwars/schema/query.ts:39-44`, `giraffes/scalars.ts:21`.
- **`queryField(name, fieldFn)`** — two args: a string `name` and a
  `QueryFieldThunk<Types>` returning a single field ref
  (`QueryFieldThunk = (t) => GenericFieldRef<unknown>`,
  `builder-options.ts:135-137`). It wraps the single field into a one-key map
  `{ [name]: field(...) }`. `builder.ts:265-268`. Example:
  `giraffes/unions.ts:30`, and `random-stuff.ts:405` (`builder.queryField('constructor', ...)`
  — proves arbitrary string names, even `'constructor'`, are accepted).
- **Both route through `configStore.addFields(this.queryRef, cb)`**
  (`builder.ts:262`, `:266`), i.e. they attach field callbacks to the existing
  `queryRef` — they never create or configure the Query type themselves.

### When are the fields merged, and does order matter?

- `configStore.addFields(param, fields)` calls `onTypeConfig(param, ...)`
  (`config-store.ts:48-64`). If the ref already has a config, the callback runs
  immediately (`ref.addFields(fields)`, `config-store.ts:62`); if not, the
  callback is **queued in `pendingTypeConfigResolutions`**
  (`config-store.ts:100-115`, esp. `:110-113`).
- The queue drains when the ref finally gets a config. `queryType()` calls
  `addTypeRef(this.queryRef)` (`builder.ts:248`), whose `ref.onConfig(...)` handler
  fires the pending callbacks: `config-store.ts:191-199`.
- **Therefore `queryField`/`queryFields` work both before and after `queryType`.**
  Called before, the field callbacks sit pending until `queryType()` registers
  the ref, then merge in. Called after, they attach immediately.
- **Verified by an example that relies on the "before" order:**
  `giraffes/index.ts` imports `./objects`, `./interfaces`, `./unions`, `./enums`,
  `./scalars`, `./inputs` (`index.ts:1-6`) — each of which calls
  `builder.queryFields(...)`/`builder.queryField(...)` (e.g.
  `giraffes/objects.ts:50`, `giraffes/interfaces.ts:34`, `giraffes/unions.ts:30`,
  `giraffes/scalars.ts:21`) — and only **afterward** calls `builder.queryType();`
  at `index.ts:9`, then `builder.toSchema()` at `index.ts:11`. So dozens of query
  fields are registered before the Query type is defined, and the schema builds.
- **Merging is additive across all sources.** `starwars/schema/query.ts` defines
  base fields via `queryType({ fields })` (`:12-37`) and then adds `r2d2` via a
  separate `queryFields((t) => ({ r2d2: ... }))` (`:39-44`) — both end up on the
  Query type. The only ordering constraint is the duplicate-field guard
  (`config-store.ts:176-178`): the same field name may not be contributed twice.
- **Field callbacks are lazy.** `addFields` stores thunks (`() => fields(...)`),
  and the field-builder is only instantiated when the thunk runs
  (`builder.ts:262`, `:266`; store side `refs/base-with-fields.ts:30-40`). Fields
  are resolved during build, not at call time.

---

## 4. Root type naming — is it always `Query`?

- **Default name is `Query`.** `name: options.name ?? 'Query'` at `builder.ts:237`;
  the ref is even constructed as `new QueryRef('Query')` (`builder.ts:78`).
- **It is renameable via `options.name`.** When `options.name` is set, both the
  config name (`builder.ts:237`) and the ref's own `name` field
  (`builder.ts:244-246`, `this.queryRef.name = options.name`) are updated, and
  `toSchema` reads the configured name back (`builder.ts:713-715`). Verified:
  `custom-root-names.ts:5-6` sets `name: 'CustomQuery'` (and correspondingly
  `mutationType({ name: 'CustomMutation' })` `:26-27`,
  `subscriptionType({ name: 'CustomSubscription' })` `:35-36`). That same file
  then reuses the freed names by declaring ordinary objects
  `builder.objectRef('Query')` etc. (`custom-root-names.ts:49,57,65`), which only
  works because the roots were renamed — confirming the root type name is fully
  decoupled from the literal string `Query`.
- The set of legal root names is the type `RootName = 'Mutation' | 'Query' | 'Subscription'`
  (`packages/core/src/types/schema-types.ts:78`); that governs the *kind slot*,
  not the emitted type name (which `name` overrides).

---

## 5. Parallel mutation / subscription APIs (confirmed only)

Same shape as query, one line each (details belong to their own dossiers):

- `mutationType(options?, fields?)` — `builder.ts:271-306`; options
  `MutationTypeOptions extends RootTypeOptions<Types,'Mutation'>` with
  `fields?: MutationFieldsShape` (`type-options.ts:74-77`).
- `mutationFields(fields)` — `builder.ts:308-310`;
  `mutationField(name, field)` — `builder.ts:312-316`.
- `subscriptionType(options?, fields?)` — `builder.ts:318-358`; options
  `SubscriptionTypeOptions extends RootTypeOptions<Types,'Subscription'>` with
  `fields?: SubscriptionFieldsShape` (`type-options.ts:79-82`).
- `subscriptionFields(fields)` — `builder.ts:360-364`;
  `subscriptionField(name, field)` — `builder.ts:366-370`.
- Defaults `'Mutation'` / `'Subscription'` at `builder.ts:282,332`; refs at
  `builder.ts:79-80`. All three roots feed `GraphQLSchema({ query, mutation,
  subscription })` at `builder.ts:723-726`, each resolved by the same
  `hasConfig ? getTypeConfig(...).name : <default>` pattern (`builder.ts:713-721`).
  Mutation/subscription differ from query in one internal detail: `queryType`
  adds fields via `this.queryRef.addFields(...)` directly (`builder.ts:250-256`),
  whereas mutation/subscription add via `this.configStore.addFields(...)`
  (`builder.ts:296-303`, `:345-355`). Both paths ultimately call
  `ref.addFields`; the observable behavior (deferred merge) is the same.

---

## 6. Surprising / docs-relevant details

- **The root refs pre-exist; `queryType` only *configures* them.** The `QueryRef`
  is created at class-init (`builder.ts:78`) but has `currentConfig = null`
  (`refs/base.ts:34`) until `queryType` calls `updateConfig`. This is why field
  calls before `queryType` are silently deferred rather than erroring
  (`config-store.ts:110-113`).
- **`queryType()` with zero arguments is idiomatic**, used to "open" the type so
  that separately-registered `queryField`/`queryFields` calls attach
  (`giraffes/index.ts:9`).
- **Duplicate field name → build-time throw**, not a call-time throw:
  `Duplicate field ${fieldName} on ${config.name}` (`config-store.ts:176-178`).
- **Duplicate typename throw** is reserved for a *different* ref claiming the same
  name: `Duplicate typename: Another type with name ${config.name} already exists.`
  (`config-store.ts:149-153`). Re-calling `queryType` does not trigger it because
  the same ref is reused and `addTypeRef` early-returns (`config-store.ts:135-138`).
- **Root types cannot implement interfaces or set `isTypeOf` via options** — those
  keys are on `ObjectTypeOptions`, not `RootTypeOptions` (§2).
- **`pothosOptions` stores the whole options bag** (`builder.ts:239`) so plugins
  can read custom keys they add to `QueryTypeOptions` via declaration merging.
- **UNVERIFIED:** the exact error/behavior when a schema is built with no query
  root at all is graphql-js's, not asserted in `packages/core` source (§1).
