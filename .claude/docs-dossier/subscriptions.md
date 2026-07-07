# Dossier: The Subscription root (`subscriptionType`, `subscriptionField`, `subscriptionFields`) and the `subscribe` + `resolve` field shape

Territory: everything a Subscriptions fundamentals page needs, from source only —
the `subscriptionType`/`subscriptionField`/`subscriptionFields` API and how it
mirrors Query/Mutation; the two-function field shape (`subscribe` returns an
`AsyncIterable`, `resolve` projects each emitted payload); the type-level link
between what `subscribe` yields and what `resolve` receives as its parent; the
fact that **graphql-js**, not Pothos, drives the iteration (F6 attribution); what
pub/sub the repo's own examples use; a hard verdict on whether subscriptions can
**run** in the browser playground; the core-vs-plugin-smart-subscriptions line on
filtering; and a claim-by-claim audit of
`website/content/docs/fundamentals/subscriptions.mdx`.

Runtime methods live in `packages/core/src/builder.ts`; field option types in
`packages/core/src/types/global/field-options.ts` and
`packages/core/src/types/builder-options.ts`; type options in
`packages/core/src/types/global/type-options.ts`. Page audited:
`website/content/docs/fundamentals/subscriptions.mdx`; playground bundle
`website/playground-examples/fundamentals-subscriptions/`.

Convention: **[runtime]** = executed code changing the emitted schema;
**[type-level]** = affects only what TypeScript accepts. **UNVERIFIED** = not
asserted in `packages/core` source (external-library or TS-compiler behavior, or
a doc claim with no source backing).

---

## 1. The three methods — exact mirror of the Query/Mutation API

`builder.ts:318-370`:

```ts
subscriptionType(
  ...args: NormalizeArgs<
    [options: PothosSchemaTypes.SubscriptionTypeOptions<Types>, fields?: SubscriptionFieldsShape<Types>],
    0
  >
) {
  const [options = {}, fields] = args;
  this.subscriptionRef.updateConfig({
    kind: 'Subscription',
    graphqlKind: 'Object',
    name: options.name ?? 'Subscription',
    description: options.description,
    pothosOptions: options as unknown as PothosSchemaTypes.SubscriptionTypeOptions,
    extensions: options.extensions,
    astNode: options.astNode,
  });
  this.configStore.addTypeRef(this.subscriptionRef);
  if (options.name) { this.subscriptionRef.name = options.name; }
  if (fields) { this.configStore.addFields(this.subscriptionRef, () => fields(new SubscriptionFieldBuilder(this))); }
  if (options.fields) { this.configStore.addFields(this.subscriptionRef, () => options.fields!(new SubscriptionFieldBuilder(this))); }
  return this.subscriptionRef;
}

subscriptionFields(fields: SubscriptionFieldsShape<Types>) {
  this.configStore.addFields(this.subscriptionRef, () => fields(new SubscriptionFieldBuilder(this)));
}

subscriptionField(name: string, field: SubscriptionFieldThunk<Types>) {
  this.configStore.addFields(this.subscriptionRef, () => ({ [name]: field(new SubscriptionFieldBuilder(this)) }));
}
```

- **[runtime]** Structurally identical to `mutationType`/`mutationField`/
  `mutationFields` (`builder.ts:271-316`) and `queryType`/`queryField`/
  `queryFields` (`builder.ts:234-269`, per the mutations dossier). Only the ref,
  the `kind`/`name` literals, and the field builder class differ.
- **Default name** is `'Subscription'` (`builder.ts:332`), overridable via
  `options.name` (`builder.ts:341-342` copies it onto the ref). Verified end to
  end by the custom-roots test: `name: 'CustomSubscription'`
  (`packages/core/tests/examples/custom-root-names.ts:36`) prints as
  `subscription: CustomSubscription`
  (`packages/core/tests/custom-roots.test.ts:11`); the default prints
  `subscription: Subscription` (`custom-roots.test.ts:22`).
- The backing ref is a single instance created eagerly at builder construction:
  `private subscriptionRef = new SubscriptionRef<Types>('Subscription')`
  (`builder.ts:80`), alongside `queryRef` (`:78`) and `mutationRef` (`:79`).
  `SubscriptionRef` is a thin subclass of `ObjectRef`:
  `export class SubscriptionRef<Types> extends ObjectRef<Types, Types['Root']> {}`
  (`packages/core/src/refs/subscription.ts:4`) — so the Subscription root is an
  ordinary GraphQL **Object** type (`graphqlKind: 'Object'` at `builder.ts:331`).
- **[type-level]** `SubscriptionTypeOptions` extends `RootTypeOptions<Types,
  'Subscription'>` and adds `fields?: SubscriptionFieldsShape<Types>`
  (`type-options.ts:79-82`) — the same shape as `MutationTypeOptions`
  (`type-options.ts:74-77`). `SubscriptionFieldsShape` /
  `SubscriptionFieldThunk` hand you a `SubscriptionFieldBuilder`
  (`builder-options.ts:123-125`, `:143-145`).
- The field builder is a near-empty subclass:
  `class SubscriptionFieldBuilder<Types, ParentShape> extends
  RootFieldBuilder<Types, ParentShape, 'Subscription'>` with
  `super(builder, 'Subscription', 'Object')`
  (`packages/core/src/fieldUtils/subscription.ts:4-11`) — so every field method
  (`t.field`, `t.string`, `t.int`, `t.boolean`, …) is inherited from the shared
  `RootFieldBuilder`; the only difference from Query/Mutation is the `'Subscription'`
  kind, which selects the `subscribe`-bearing options type below.

## 2. The field shape: `subscribe` returns an `AsyncIterable`, `resolve` gets the emitted payload

Subscription fields carry an **extra required option** that Query/Mutation
fields do not: `subscribe`. `SubscriptionFieldOptions`
(`field-options.ts:145-173`):

```ts
export interface SubscriptionFieldOptions<
  Types, Type, Nullable, Args, ResolveShape, ResolveReturnShape
> extends FieldOptions<Types, Types['Root'], Type, Nullable, Args, ResolveShape, ResolveReturnShape> {
  subscribe: Subscriber<
    Types['Root'],
    InputShapeFromFields<Args>,
    Types['Context'],
    ResolveShape
  >;
}
```

- **What `subscribe` must return.** `Subscriber` (`builder-options.ts:82-88`):

  ```ts
  export type Subscriber<Parent, Args, Context, Shape> = (
    parent: Parent, args: Args, context: Context, info: GraphQLResolveInfo,
  ) => MaybePromise<AsyncIterable<Shape>>;
  ```

  So `subscribe` receives the **root value** as its first arg (`Types['Root']`,
  not a parent entity — subscription fields sit on the root), the field's args,
  the context, and `info`; it must return (or promise) an **`AsyncIterable<Shape>`**.
  `AsyncIterable` (has `[Symbol.asyncIterator]`), not a bare `AsyncIterator`. An
  `async function*` generator satisfies this — see
  `custom-root-names.ts:39-44` (`subscribe: async function* () { for … yield … }`).

- **How `subscribe`'s yielded type reaches `resolve`'s parent — the mechanism.**
  `ResolveShape` is a **free type parameter** threaded through both options:
  - `subscribe: Subscriber<…, ResolveShape>` yields `AsyncIterable<ResolveShape>`
    (`field-options.ts:168-173`).
  - The `resolve` supplied for a Subscription field is the standard inferred
    `Resolve` option whose **parent is `ResolveShape`**:
    `resolve: Resolver<ResolveShape, InputShapeFromFields<Args>, Types['Context'],
    ShapeFromTypeParam<Types, Type, Nullable>, ResolveReturnShape>`
    (`field-options.ts:38-46`, inside `InferredFieldOptions.Resolve`). The
    Subscription entry of `FieldOptionsByKind` composes
    `SubscriptionFieldOptions & InferredFieldOptionsByKind<…, ResolveShape, …>`
    (`field-options.ts:205-217`).
  - `Resolver`'s first parameter is `parent: Parent` (`builder-options.ts:44-51`).

  Net: the **same `ResolveShape`** is the element type `subscribe` yields *and*
  the parent type `resolve` receives. TypeScript unifies the two through this
  shared variable, so `resolve`'s first argument is **each emitted payload**, not
  the object-type parent. This is exactly what the real examples do:
  `subscribe: (_root, args, ctx) => ctx.pubsub.subscribe('post', args.id)` paired
  with `resolve: (event) => event`
  (`examples/prisma-subscriptions/src/schema.ts:286-287`, and `:291-292`,
  `:300-301`, `:305-306`); and the trivial `resolve: (i) => i` over a stream of
  `number` (`custom-root-names.ts:39-45`).

- **[runtime] Pothos threads both functions straight onto the graphql-js field.**
  `subscribe` is read off the options and placed on the field config next to
  `resolve` (`packages/core/src/fieldUtils/base.ts:62,84`; original also stashed
  at `extensions.pothosOriginalSubscribe`, `:78`). At build time it is passed
  through `plugin.wrapSubscribe` and set on the built GraphQL field's `subscribe`
  slot (`packages/core/src/build-cache.ts:344,359`). Pothos adds **no** iteration
  machinery of its own — it maps `{ subscribe, resolve }` onto the
  `GraphQLFieldConfig`.

- The `subscribe`/`resolve` split is documented on the type itself only as the
  standard resolver jsdoc (`field-options.ts:160-167`) — there is **no** source
  assertion that the two functions must be declared in a particular order (see
  §6, the ordering callout).

## 3. Who drives the iteration — graphql-js, not Pothos (F6)

Pothos's role ends at **typing + schema assembly**. The Subscription object type
is handed to graphql-js as the schema's `subscription` root:
`new GraphQLSchema({ query, mutation, subscription: buildCache.types.get(subscriptionName) … })`
(`builder.ts:723-726`; `subscriptionName` resolved at `:719-721`, defaulting to
`'Subscription'`).

Execution is entirely graphql-js:

- The core test drives subscriptions with graphql-js's **`subscribe`** (not
  `execute`): `import { execute, …, subscribe } from 'graphql'`
  (`custom-roots.test.ts:1`); the subscription test calls
  `await subscribe({ schema, document })` then `for await (const value of result …)`
  (`custom-roots.test.ts:99-111`), whereas queries and mutations use `execute`
  (`:44`, `:81`). This is the canonical split: **`subscribe()` builds the source
  event stream from the field's `subscribe`, then maps each event through
  `resolve`; `execute()` does not.**
- In graphql-js 17 (installed: `node_modules/graphql/version.js` → `17.0.1`),
  `subscribe()`/`createSourceEventStream()` call the field's `subscribe` to get
  the event stream (`node_modules/graphql/execution/execute.js:339-358`,
  `executeSubscription` reading `schema.getSubscriptionType()` and the field's
  subscribe), then `mapSourceToResponseEvent` runs each event through the normal
  executor (`execute.js:321`). **UNVERIFIED (external library)** as to precise
  internals, but the public contract is fixed by the graphql-js API the test
  exercises.

Takeaway for the page: Pothos gives you a typed `{ subscribe, resolve }` and a
Subscription object type; **your GraphQL server (graphql-js under graphql-yoga /
Apollo / Mercurius) drives the actual iteration and per-event resolution.**

## 4. Pub/sub in the repo's examples, and the playground runnability verdict

**What the repo's examples use.** There is no Pothos-provided pub/sub — it lives
on `ctx`:

- `examples/prisma-subscriptions/` uses **graphql-yoga's `createPubSub`**:
  `import { createPubSub } from 'graphql-yoga'` … `export const pubsub =
  createPubSub<PuSubEvents>({})`
  (`examples/prisma-subscriptions/src/pubsub.ts:1,32`); consumed via
  `ctx.pubsub.subscribe(topic, id)` in `subscribe` and `ctx.pubsub.publish(topic,
  id, payload)` in mutation resolvers
  (`examples/prisma-subscriptions/src/schema.ts:286,108`). The pubsub is put on
  context in the server (`examples/prisma-subscriptions/src/server.ts:3-9`).
- `examples/prisma-smart-subscriptions/` uses **`graphql-subscriptions`'
  `PubSub`**: `import { PubSub } from 'graphql-subscriptions'` … `new PubSub()`
  (`examples/prisma-smart-subscriptions/src/pubsub.ts:1-3`,
  `context.ts:1,16`) — this is the smart-subscriptions plugin path (see §5).
- The playground bundle's `schema.ts` deliberately avoids a real pub/sub and
  uses a self-contained `async function* publishEntries(): AsyncIterableIterator<string>`
  as the event source, with a header comment noting you'd "swap this for
  graphql-yoga's createPubSub, Redis pub/sub, etc."
  (`website/playground-examples/fundamentals-subscriptions/schema.ts`, lines
  around the `publishEntries` definition and the `subscribe: () => publishEntries()`
  field).

**Does a subscriptions playground bundle exist?** Yes:
`website/playground-examples/fundamentals-subscriptions/` (`schema.ts`,
`query.graphql`, `metadata.json`). `metadata.json` id `fundamentals-subscriptions`,
`relatedDocs: ["/docs/fundamentals/subscriptions"]`. The registered snippet
region is `#region character-added-subscription` → `#endregion`, a
`builder.subscriptionType({ fields: (t) => ({ characterAdded: t.string({ …
subscribe: () => publishEntries(), resolve: (name) => name }) }) })`. `query.graphql`
is `subscription NewCharacters { characterAdded }`.

**Runnability verdict: VALIDATE / BUILD-ONLY — subscriptions CANNOT truly run in
the browser playground.** The playground's operation runner executes with
graphql-js **`graphql()`** (i.e. `execute`), never `subscribe()`:
`website/hooks/playground/useQueryRunner.ts:1` imports `graphql` from `'graphql'`
and calls `graphql({ schema, source: query, variableValues, operationName,
contextValue })` (`useQueryRunner.ts` run body, the single `graphql({…})` call).
There is **no** call to `subscribe`, `createSourceEventStream`, or any event-stream
consumer anywhere in the playground (`website/lib/playground/execution-engine.ts`
only builds/prints the schema — `executeAndBuildSchema` runs the *user's TS* to
produce a `GraphQLSchema`, importing only `printSchema`,
`execution-engine.ts:2,143`). Consequences when a user hits Run on the
subscription operation:

1. graphql-js `execute` **does** accept a subscription operation — it resolves
   the Subscription root type's fields once, via each field's **`resolve`**, with
   the **root value (here `contextValue`-free `undefined`/rootValue) as parent**,
   and **never calls `subscribe`** (`node_modules/graphql/execution/Executor.js:114`
   `schema.getRootType(operationType)` → executes fields normally). **UNVERIFIED
   (external library)** beyond the code path read.
2. In the bundle, `resolve: (name) => name` therefore receives `undefined` (no
   event stream feeds it), and `characterAdded` is a non-null `String!`
   (`t.string` with Pothos's default field nullability), so the run yields a
   nullability error rather than a stream of names.

So the playground lets you **author, typecheck, build, and inspect the SDL** of a
subscription schema, and validate the operation against it — but it cannot
observe streamed events. The page must not imply "press Run to watch events."

## 5. Filtering: what's core vs `plugin-smart-subscriptions`

- **Core** has no filtering primitive. Filtering is just ordinary code:
  - **Per-event drop in `resolve`** — return `null` for uninteresting events (the
    field must be `nullable`). This is nothing but a resolver returning `null`;
    graphql-js filters nothing for you. (No core API involved.)
  - **Upstream filter in `subscribe`** — return an already-filtered
    `AsyncIterable`. The mechanism (topic keys, predicate iterables) belongs to
    whatever pub/sub you put on `ctx` — e.g. `ctx.pubsub.subscribe('post', args.id)`
    filters by id at the pub/sub layer
    (`examples/prisma-subscriptions/src/schema.ts:286`). Core only requires that
    `subscribe` return an `AsyncIterable<ResolveShape>` (§2).

- **`@pothos/plugin-smart-subscriptions`** is a **different model entirely** and
  must not be taught as core behavior. It "turns queries into subscriptions": you
  run a query, and fields/types register subscriptions that **re-execute the
  query** (or a sub-tree) when triggered
  (`packages/plugin-smart-subscriptions/README.md:1-16`). It brings its own
  `smartSubscriptions` builder option, a `SubscriptionManager`
  (`packages/plugin-smart-subscriptions/src/manager/`), field-level `subscribe`
  registration, and caching (`.../resolve-with-cache.ts`, `.../cache.ts`). Its
  example uses `graphql-subscriptions`' `PubSub`
  (`examples/prisma-smart-subscriptions/src/pubsub.ts`). None of this is the core
  `subscribe`+`resolve` field shape; a fundamentals page should stay on the core
  model and, at most, point at the plugin as an alternative.

## 6. Claim-by-claim audit of `website/content/docs/fundamentals/subscriptions.mdx`

| Location | Claim | Verdict | Source |
|---|---|---|---|
| Frontmatter / intro | "A subscription field has two functions: `subscribe` returns an async iterable of events, and `resolve` projects each event." | **CORRECT** | `Subscriber` returns `MaybePromise<AsyncIterable<Shape>>` (`builder-options.ts:82-88`); `resolve` parent = `ResolveShape` = yielded type (`field-options.ts:168-172`, `:38-46`). |
| Included snippet | `<include … example="fundamentals-subscriptions">…#character-added-subscription</include>` | **CORRECT / exists** | Region present in `website/playground-examples/fundamentals-subscriptions/schema.ts`. |
| Body | "`subscribe` runs once when the subscription starts. Each value the iterable yields becomes one message; `resolve` shapes it." | **CORRECT** (graphql-js contract) | graphql-js `subscribe` builds the stream, maps each event through `resolve` (`custom-roots.test.ts:99-111`; `execute.js:321,339-358`). **UNVERIFIED** internals (external lib). |
| Body | "For trivial cases the resolver is `(name) => name` … takes the iterable's element type and returns the field's GraphQL type." | **CORRECT** | Matches `resolve: (i) => i` / `(event) => event` and the `ResolveShape → parent` typing (§2). |
| Callout (warn) | "Declare `subscribe` before `resolve`… Pothos infers `resolve`'s parent type from `subscribe`'s element type, and the inference only works when `subscribe` appears first." | **UNVERIFIED — no source backing.** | The options types share a free `ResolveShape` (`field-options.ts:168-172` vs `:41-46`) but **enforce no ordering**; whether object-literal key order changes TS inference is a compiler behavior, not a Pothos guarantee. Real examples in-repo happen to write `subscribe` before `resolve` (`schema.ts:286-287`; `custom-root-names.ts:39-45`) but that is not evidence the reverse fails. Should be reworded to not state a Pothos mechanism, or verified against `tsc`. |
| "The pub/sub pattern" | `addCharacter` uses `t.boolean` and `resolve: … return true;` | **WRONG re: curriculum — see below.** | The publisher returns `Boolean!`, contradicting the Mutations page's return-the-entity convention (mutations dossier §7, `.claude/docs-dossier/mutations.md:232-238`). |
| "The pub/sub pattern" | `subscribe: (…, ctx) => ctx.pubSub.subscribe('CHARACTER_ADDED')`, `resolve: (event) => event`. | **CORRECT shape** | Mirrors `examples/prisma-subscriptions/src/schema.ts:286-287`. Note: prose code uses `ctx.pubSub` (camelCase P) while the repo example uses `ctx.pubsub`; either is fine (it's user context, §4) but be internally consistent. |
| "The pub/sub pattern" | "The pub/sub itself isn't part of Pothos — it lives on your context. `graphql-yoga` ships `createPubSub`…; Apollo Server has its own. For multi-process, swap in Redis-backed." | **CORRECT** | No pub/sub in `packages/core`; `createPubSub` is graphql-yoga (`examples/prisma-subscriptions/src/pubsub.ts:1`). Redis/distributed claim is general guidance — **UNVERIFIED** (no repo artifact) but uncontroversial. |
| "Filtering" | Filter in `resolve`, return `null` for non-matching (field `nullable: true`). | **CORRECT (core)** | Just a nullable resolver returning `null`; §5. |
| "Filtering" | "push the filter into the `subscribe` call so the iterable never emits… mechanism depends on your pub/sub." | **CORRECT (core)** | `subscribe` may return any filtered `AsyncIterable`; mechanism is pub/sub-specific (§5). Correctly does **not** invoke smart-subscriptions. |
| "Authorization" | Throw in `subscribe` to reject before events; per-event checks in `resolve` are rare. | **CORRECT / plausible** | `subscribe` runs once at stream open (graphql-js); a throw there rejects the subscription. Consistent with the `Subscriber` contract. **UNVERIFIED** exact rejection semantics (external lib). |
| Callout (info) | Links to `./mutations` (publisher) and `./context` (where the pub/sub handle lives). | **CORRECT / good curriculum** | Cross-links, doesn't re-teach context. |

### Curriculum requirements (from the brief)

1. **`subscriptionType` taught as the third root — currently a GAP.** The prose
   body and every inline code block use `builder.subscriptionField(...)` /
   `builder.mutationField(...)`; `builder.subscriptionType` appears **only**
   indirectly, inside the included playground snippet
   (`schema.ts` `character-added-subscription` region). The page never explicitly
   frames `subscriptionType` as the third root type mirroring `queryType`/
   `mutationType` (which is the actual API symmetry — §1, `builder.ts:234/271/318`).
   To meet the curriculum, teach `subscriptionType` explicitly as the third root.

2. **`addCharacter` must return the entity — currently WRONG.** The "pub/sub
   pattern" block defines `addCharacter` as `t.boolean` returning `true`
   (subscriptions.mdx, "The pub/sub pattern" section). This contradicts the
   Mutations page, which teaches returning the changed **entity** (`Character`)
   and explicitly says a bare `Boolean!` is worse than a payload type
   (mutations dossier §7 citing mutations.mdx L53-66,
   `.claude/docs-dossier/mutations.md:232-238`). Fix: have `addCharacter` return
   the created `Character` (and publish it), matching the mutation convention and
   giving the subscription a real entity to project.

3. **Auth-at-`subscribe` should link to Context for narrowing, not re-teach —
   PARTIALLY MET.** The Authorization section already ends with an info Callout
   pointing to `./context`, but it **also re-teaches** narrowing inline
   (`if (!ctx.user) throw …`). Per the curriculum, lean on the link for the
   narrowing mechanics rather than duplicating the Context page's teaching; keep
   only the subscription-specific point (authorize once at `subscribe`, trust for
   the stream's lifetime).

---

## Appendix: quick citation index

- API methods: `packages/core/src/builder.ts:318-370` (`subscriptionType`
  `:318-358`, `subscriptionFields` `:360-364`, `subscriptionField` `:366-370`);
  refs at `:78-80`; schema assembly `:719-726`.
- Field builder: `packages/core/src/fieldUtils/subscription.ts:4-11`.
- `subscribe` option type: `field-options.ts:145-173`; `Subscriber`
  `builder-options.ts:82-88`.
- `resolve` parent = `ResolveShape`: `field-options.ts:38-46`, `:205-217`;
  `Resolver` `builder-options.ts:44-51`.
- Type options: `type-options.ts:79-82`; shapes `builder-options.ts:123-125`,
  `:143-145`.
- subscribe→graphql-js field: `fieldUtils/base.ts:62,78,84`;
  `build-cache.ts:344,359`.
- Iteration driven by graphql-js: `packages/core/tests/custom-roots.test.ts:1,99-111`;
  example `packages/core/tests/examples/custom-root-names.ts:35-46`.
- Pub/sub in examples: `examples/prisma-subscriptions/src/pubsub.ts:1,32`,
  `.../schema.ts:286-306,108`; `examples/prisma-smart-subscriptions/src/pubsub.ts:1-3`.
- Playground bundle: `website/playground-examples/fundamentals-subscriptions/`
  (`schema.ts`, `query.graphql`, `metadata.json`).
- Playground executes via `graphql()` only:
  `website/hooks/playground/useQueryRunner.ts:1` + its single `graphql({…})` call;
  `website/lib/playground/execution-engine.ts:2,143` (schema build/print only).
- graphql version: `node_modules/graphql/version.js` → `17.0.1`; execute path
  `node_modules/graphql/execution/Executor.js:114`, `execute.js:321,339-358`.
- Smart-subscriptions (NOT core): `packages/plugin-smart-subscriptions/README.md:1-16`;
  `packages/plugin-smart-subscriptions/src/manager/`, `.../resolve-with-cache.ts`.
