# Dossier: First server (getting-started/first-server) — running a Pothos schema with graphql-yoga

Territory: the `getting-started/first-server` page — how the emitted
`GraphQLSchema` is handed to `graphql-yoga`, the `createYoga({ schema })` call,
the per-request `context` factory, the served endpoint and GraphiQL, and the
minimal `t.arg.string()` / `Context`-generic surface the page leans on.

All citations are into the worktree at
`.../scratchpad/pg-audit/`. Paths below are repo-relative from that root.
graphql-yoga type citations are into the installed copy at
`node_modules/.pnpm/graphql-yoga@5.21.0_graphql@17.0.1/node_modules/graphql-yoga/`.

Convention: **[verified]** = confirmed against repo source or yoga's own
`.d.ts`; **[UNVERIFIED]** = not provable from repo code / yoga types.

The page source is `website/content/docs/getting-started/first-server.mdx`.

---

## 0. Version ground truth

- graphql-yoga pinned to **`5.21.0`** in both example apps that serve a schema:
  `examples/lord-of-the-rings/package.json:19` and
  `examples/simple-classes/package.json:20` (`"graphql-yoga": "5.21.0"`).
- Installed & resolved: two variants exist in the store —
  `node_modules/.pnpm/graphql-yoga@5.21.0_graphql@17.0.1/...` and
  `...graphql-yoga@5.21.0_graphql@16.13.2/...` (confirmed by
  `find . -path "*/graphql-yoga/package.json"`), and the lockfile lists
  `graphql-yoga@5.21.0` at `pnpm-lock.yaml:7960` and the graphql-17-peered build
  at `pnpm-lock.yaml:18786` (`graphql-yoga@5.21.0(graphql@17.0.1)`). So yoga
  5.21.0 runs against both graphql 16 and 17 in this repo.
- Everything below citing yoga `.d.ts` is read from the `graphql@17.0.1` variant;
  the `.d.ts`/`.d.cts` pair are identical for the facts cited.

---

## 1. Page claim inventory (every factual claim, verified or flagged)

### Claim A — "createYoga accepts the schema and returns a standard request handler" (`first-server.mdx:26`)
- **[verified]** `createYoga` takes an options object whose `schema` key is
  `YogaSchemaDefinition<...>` — `typings/server.d.ts:60` (`schema?: YogaSchemaDefinition<...>`).
- **[verified] as real repo usage**: passing the yoga instance straight to
  Node's `createServer` is exactly what the shipped examples do —
  `examples/simple-classes/src/server.ts:5-9`
  (`const yoga = createYoga({ schema }); const server = createServer(yoga);`) and
  `examples/lord-of-the-rings/src/server.ts:6-14`. So "returns a standard request
  handler" is confirmed empirically by repo code (yoga is callable as a Node
  request listener). The word "standard" is prose, not a typed guarantee.

### Claim B — the server snippet: `createServer` from `node:http`, `createYoga({ schema, context: () => ({}) })`, `server.listen(4000, ...)` (`first-server.mdx:28-43`)
- **[verified]** `createServer` from `node:http` + `createYoga` from
  `graphql-yoga` is the exact import pair in
  `examples/lord-of-the-rings/src/server.ts:1-2` and
  `examples/simple-classes/src/server.ts:1-2`.
- **[verified]** `context: () => ({})` is a legal `context` value: the option is
  `context?: ((initialContext) => Promise<TUserContext> | TUserContext) | ... | undefined`
  — `typings/server.d.ts:34`. A zero-arg function returning `{}` satisfies it.
- Port `4000` is the page's own choice, **not** a yoga default and **not** a
  claim of a default. The repo examples instead use `3000` /
  `process.env.PORT ?? 3000` (`examples/simple-classes/src/server.ts:11`,
  `examples/lord-of-the-rings/src/server.ts:15`). No conflict — page's
  `listen(4000)` and its `http://localhost:4000/graphql` URL (`mdx:41,45`) are
  internally consistent.

### Claim C — "Visit http://localhost:4000/graphql and you'll get GraphiQL — yoga serves it automatically on the same endpoint" (`first-server.mdx:45`)
- **[verified] endpoint `/graphql`**: `graphqlEndpoint` option is
  `@default "/graphql"` — `typings/server.d.ts:36-42`. Confirmed independently by
  the shipped example logs: `http://localhost:${port}/graphql`
  (`examples/lord-of-the-rings/src/server.ts:17`).
- **[verified] GraphiQL on by default**: `graphiql` option is `@default true`
  — `typings/server.d.ts:54-58`. GraphiQL is served at the graphql endpoint by
  default: `typings/plugins/use-graphiql.d.ts:128`
  ("Defaults to the graphql endpoint (\"/graphql\" by default)").
- So "GraphiQL, served automatically on the same endpoint" is **[verified]**.
  The page's implied GET-to-see-GraphiQL is standard yoga behavior; the type
  proves the default-on + same-endpoint facts.

### Claim D — the query / expected response (`first-server.mdx:51-64`)
- Query `hello(name: "Frodo")` → `"Hello, Frodo."`.
- **[verified] against the actual schema snippet** the page single-sources:
  `website/playground-examples/getting-started-first-server/step-1/schema.ts:8-12`
  resolves `hello` as `` `Hello, ${name ?? 'friend'}.` ``. With `name: "Frodo"`
  the output is `"Hello, Frodo."` — matches. The identical `query Greet { hello(name: "Frodo") }`
  is the bundle's own query file
  (`website/playground-examples/getting-started-first-server/step-1/query.graphql`).
- Note the `?? 'friend'` fallback is load-bearing: `t.arg.string()` is
  **nullable by default** (see §5), so `name` is `string | null | undefined` and
  the resolver must handle absence. The snippet is self-consistent.

### Claim E — "The context: option on createYoga runs once per request" (`first-server.mdx:69`)
- **[verified in part]** The `context` option receives the per-request
  `YogaInitialContext` — `typings/server.d.ts:34` (`(initialContext: YogaInitialContext & TServerContext) => ...`),
  and `YogaInitialContext` is a per-request object carrying `request: Request`
  and `params: GraphQLParams` (`typings/types.d.ts:14-24`).
- **[UNVERIFIED — frequency]** The literal "runs once per request" cadence is
  not provable from the type signature alone (a type shows shape, not call
  count). It matches yoga's documented per-request context behavior, but this
  dossier cannot cite a repo line proving "exactly once." Treat the shape claim
  as verified and the once-per-request cadence as yoga-documented-but-unverified-here.

### Claim F — the context-factory example: `context: async ({ request }) => ({ user: await decodeUserFromToken(request.headers.get('authorization')), db })` (`first-server.mdx:71-79`)
- **[verified] destructuring `{ request }`**: `YogaInitialContext.request` is a
  Fetch `Request` (`typings/types.d.ts:22-23`), so `request.headers.get('authorization')`
  is valid (standard Fetch `Headers.get`).
- `async` context is allowed: the option's return type includes
  `Promise<TUserContext>` (`typings/server.d.ts:34`).
- `decodeUserFromToken` and `db` are illustrative free identifiers (page never
  defines them) — this is intentional pedagogy, not a runnable snippet.

### Claim G — "Once you give the builder generic a matching Context shape, the type flows through to every resolver" (`first-server.mdx:81`)
- **[verified] mechanism** — see §3. The builder declares `Context` on the
  `SchemaTypes` generic; core's default `Context` is `object`
  (`packages/core/src/types/schema-types.ts:32`).

### Claim H — framing: yoga is "the smallest path" but "Apollo Server, Mercurius, and graphql-http all accept the same schema" (`first-server.mdx:8`)
- **[UNVERIFIED]** No Apollo/Mercurius/graphql-http usage exists anywhere in
  `examples/` (grep for `graphql-yoga|createYoga` returns only yoga servers).
  The claim that those servers accept a plain `GraphQLSchema` is true of the
  GraphQL ecosystem generally but is not backed by any file in this repo. Prose
  positioning, not a repo-verifiable fact.

### Claim I — install: `npm install graphql-yoga` (`first-server.mdx:12-14`)
- **[verified] as consistent** with the pinned `graphql-yoga: 5.21.0` the repo
  uses (§0). `package-install` is a fumadocs directive; the package name is
  correct.

---

## 2. graphql-yoga wiring as actually used in THIS repo (canonical patterns)

The two schema-serving examples are the ground truth. Minimal untyped form:

- `examples/simple-classes/src/server.ts:1-12`
  ```ts
  import { createServer } from 'node:http';
  import { createYoga } from 'graphql-yoga';
  import { schema } from './schema.ts';
  const yoga = createYoga({ schema });
  const server = createServer(yoga);
  const port = 3000;
  server.listen(port);
  ```
  This is the smallest real form — **no `context` at all** (context is optional,
  `typings/server.d.ts:34`).

Typed + context form (this is the pattern the page's §"context factory" gestures at):

- `examples/lord-of-the-rings/src/server.ts:6-17`
  ```ts
  const yoga = createYoga<object, Context>({
    schema,
    context: () => ({ userId: 'u-frodo-fan' }),
  });
  const server = createServer(yoga);
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => {
    console.log(`GraphQL ready at http://localhost:${port}/graphql`);
  });
  ```
  Note `createYoga<object, Context>` — the SECOND generic is the user-context
  type, wired to the SAME `Context` interface the builder uses (imported from
  `./builder.ts`, `examples/lord-of-the-rings/src/server.ts:3`). The page's
  server snippet uses the **untyped** `createYoga({ ... })` form and does not
  show this generic; the deep typing lives in the example, not the page.

Repo-verified yoga defaults (all from `typings/server.d.ts`):
- `graphqlEndpoint` default `"/graphql"` — `server.d.ts:36-42`.
- `graphiql` default `true` — `server.d.ts:54-58`.
- `healthCheckEndpoint` default `"/health"` — `server.d.ts:44-48` (page does not
  mention it; noted for completeness).

---

## 3. Context factory — minimal working form (Context on SchemaTypes)

The Context type is declared on the builder's `SchemaTypes` generic, then yoga's
`context` function must return a value assignable to it.

- **Builder side** — declare `Context` on the generic:
  `examples/lord-of-the-rings/src/builder.ts:3-10`
  ```ts
  export interface Context {
    userId?: string;
  }
  export const builder = new SchemaBuilder<{
    Context: Context;
  }>({});
  ```
- **Core default** — if you omit it, `Context` defaults to `object`:
  `packages/core/src/types/schema-types.ts:32` (`Context: object;`). This is the
  key on the base `SchemaTypes` interface, so `new SchemaBuilder({})` (as the
  page's step-1 schema does, `.../step-1/schema.ts:4`) gets `Context = object` —
  which is why `context: () => ({})` type-checks in the page's server snippet.
- **Yoga side feeds it** — the second `createYoga` generic is the user context,
  and the `context` factory's return type must match:
  `examples/lord-of-the-rings/src/server.ts:6-12` returns `{ userId: '...' }`,
  matching `Context`.
- The page keeps to the minimal form (`context: () => ({})`, `mdx:35`; the typed
  flow-through is only asserted in prose at `mdx:81`). Deep teaching is
  deferred to the Context page (`mdx:81` link). This dossier does not reproduce it.

---

## 4. Playground bundle situation (single-sourcing status)

Bundle exists at `website/playground-examples/getting-started-first-server/`:
- `metadata.json` — id `getting-started-first-server`, category `core`, two
  steps `step-1`/`step-2` (`metadata.json:1-26`); step-2 sets
  `defaultActiveFile: "server.ts"` (`metadata.json:23`).
- `step-1/schema.ts` — the minimal schema, **wrapped in region markers**
  `// #region schema` (line 1) / `// #endregion schema` (line 16).
- `step-2/schema.ts` — same schema, **no region markers**.
- `step-2/server.ts` — the yoga server, guarded with
  `// @ts-nocheck` because node/yoga aren't installed in the playground sandbox
  (`.../step-2/server.ts:1`).
- `step-1/query.graphql`, `step-2/query.graphql` — the `query Greet` doc.

**Single-sourcing status of the page's two code snippets:**
1. **The schema block IS single-sourced.** `first-server.mdx:20` uses fumadocs'
   built-in `<include>` pulling
   `playground-examples/getting-started-first-server/step-1/schema.ts#schema` —
   the `#schema` region defined by the markers above. (The repo's
   `website/lib/remark-multi-region.ts:2-31` documents that the built-in
   `<include>` extracts one `// #region <name>` block; the multi-region
   companion `<includeregions>` is a separate tag and is NOT used here.) So the
   schema snippet cannot drift from the bundle.
2. **The server block is NOT single-sourced — it is an inline fence.**
   `first-server.mdx:28-43` is a literal ```` ```typescript ```` block, even
   though `.../step-2/server.ts` contains the same code. The two are duplicated.
   They currently AGREE (both: `context: () => ({})`, `createServer(yoga)`,
   `listen(4000)`, log `http://localhost:4000/graphql`) — compare
   `mdx:33-42` vs `.../step-2/server.ts:9-19` — but there is no mechanism
   preventing future drift. The context-factory snippet (`mdx:71-79`) is also
   an inline fence with no bundle counterpart.
- **[UNVERIFIED]** The `<include>` meta `example="getting-started-first-server-step-1"`
  (`mdx:20`) and the inline fence's `example="getting-started-first-server-step-2"`
  (`mdx:28`) use composite `-step-1`/`-step-2` ids, whereas `metadata.json` id is
  `getting-started-first-server` with nested `steps[].id` of `step-1`/`step-2`.
  Whether the playground-link resolver maps `<bundle>-<step>` to that structure
  is not verified from the files read here.

---

## 5. `t.arg.string()` — exact API shape (from core source)

The page relies on `t.arg.string()` via the included schema
(`.../step-1/schema.ts:9`, `args: { name: t.arg.string() }`). Verified chain:

- `t.arg` is an `ArgBuilder<Types>` built once per field builder:
  `packages/core/src/fieldUtils/root.ts:22`
  (`arg: ArgBuilder<Types> = new InputFieldBuilder<Types, 'Arg'>(this.builder, 'Arg').argBuilder();`).
- `.string` is a prototype helper on the input field builder:
  `packages/core/src/fieldUtils/input.ts:52` (`string = this.helper('String');`).
- `helper` returns a function whose options arg is **optional** —
  `packages/core/src/fieldUtils/input.ts:175-188`:
  ```ts
  private helper<Type ...>(type: Type) {
    return <Req ...>(...args: NormalizeArgs<[options: Omit<InputFieldOptionsByKind<...>, 'type'>]>) => {
      const [options = {} as never] = args;   // input.ts:181
      return this.field({ ...options, type });
    };
  }
  ```
  `NormalizeArgs<[options]>` + the `= {}` default is what makes the **zero-arg**
  call `t.arg.string()` legal — no options required. The `'type'` key is omitted
  from options because the helper injects it (`type` = `'String'`).
- `argBuilder()` copies these helpers onto a callable so `t.arg.string(...)` and
  `t.arg({ type, ... })` both work:
  `packages/core/src/fieldUtils/input.ts:98-117`.
- **Requiredness default**: `t.arg.string()` with no `required` option is
  **nullable** (this is why the page's resolver needs `name ?? 'friend'`,
  §Claim D). The default-requiredness machinery is
  `DefaultInputFieldRequiredness` on `SchemaTypes`
  (`packages/core/src/types/schema-types.ts:29`); the precise default value is
  owned by the fields/args dossier and not re-derived here — but the observable
  contract (nullable-by-default → `?? 'friend'`) is confirmed by the snippet.

---

## 6. Summary of findings

- **VERIFIED**: yoga `5.21.0` (examples pkg + lockfile); `createServer(node:http)` +
  `createYoga({ schema })` is the real repo pattern
  (`examples/simple-classes/src/server.ts:1-9`); `graphqlEndpoint` default
  `/graphql` (`server.d.ts:36-42`); `graphiql` default `true`
  (`server.d.ts:54-58`); `context` receives per-request `YogaInitialContext` with
  `request: Request` (`server.d.ts:34`, `types.d.ts:14-24`); `Context` on
  `SchemaTypes` defaults to `object` (`schema-types.ts:32`) and is declared via
  the builder generic (`lord-of-the-rings/src/builder.ts:3-10`); `t.arg.string()`
  zero-arg call legal (`input.ts:52,175-188`).
- **No page claim is factually WRONG.** Port 4000 and GraphiQL-on-same-endpoint
  are internally consistent and default-backed. One nuance: the page shows the
  UNTYPED `createYoga({...})` form, so its "type flows through to every resolver"
  line (`mdx:81`) is only realized when you add the `createYoga<_, Context>`
  generic as the example does — the page under-shows the wiring but does not
  misstate it.
- **UNVERIFIED (do not assert)**: (1) "context runs once per request" cadence
  (`mdx:69`) — only the per-request *shape* is type-proven, not the call count;
  (2) Apollo/Mercurius/graphql-http "accept the same schema" (`mdx:8`) — no repo
  usage; (3) playground `example="...-step-1/-step-2"` id resolution vs
  `metadata.json`'s nested step ids.
- **Single-sourcing gap**: the schema block IS an `<include>` from the bundle
  (`mdx:20`), but the server block (`mdx:28-43`) and context-factory block
  (`mdx:71-79`) are INLINE fences duplicating `.../step-2/server.ts` — they
  currently agree but are drift-prone.
