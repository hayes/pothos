# Dossier: Resolvers (fundamentals/resolvers) — signature, return contract, info, errors

Territory: the `fundamentals/resolvers` page — the four resolver arguments Pothos
declares `(parent, args, context, info)`, what `info` genuinely is (and whether the
"ORM plugins use it" claim is honest), what a resolver may return, the default
resolver / `expose*` mechanics, and error behavior on throw.

All citations are repo-relative from the worktree at `.../scratchpad/pg-audit/`.

Convention: **[verified]** = confirmed against repo source (or a repo test as
behavior evidence); **[UNVERIFIED]** = not provable from repo code read here.

The page source is `website/content/docs/fundamentals/resolvers.mdx`.

---

## 0. The core fact: Pothos does NOT invoke resolvers — graphql-js does

Pothos is a schema *builder*. It emits a `GraphQLSchema` whose field configs carry
a `resolve` function; the graphql-js executor is what calls that function with the
four arguments. Pothos never runs an execution loop and never awaits a resolver
result itself. Two proofs:

- The base plugin's `wrapResolve` is the identity function — it returns the
  resolver unchanged: `packages/core/src/plugins/plugin.ts:104-109`
  (`wrapResolve(resolver, _fieldConfig) { return resolver; }`). So with no plugins,
  Pothos adds **zero** wrapping around your resolve function.
- There is no try/catch and no `await`/`isThenable` gate around field resolution in
  the field-build path of `packages/core/src/build-cache.ts` (the `resolve` value is
  assembled at `build-cache.ts:343-360` and handed straight to the emitted
  `GraphQLFieldConfig`; `isThenable` is used only in the **type resolver** path at
  `build-cache.ts:653`, not for field resolvers).

This underlies the honest attribution corrections in §6 (the page says "Pothos
awaits" / "Pothos handles the awaiting" — it is the **graphql-js executor** that
awaits and that catches throws).

---

## 1. The exact resolver signature Pothos declares

- **[verified]** The resolver type is `Resolver<Parent, Args, Context, Type, Return>`
  at `packages/core/src/types/builder-options.ts:44-51`:
  ```ts
  export type Resolver<Parent, Args, Context, Type, Return = unknown> = (
    parent: Parent,
    args: Args,
    context: Context,
    info: GraphQLResolveInfo,
  ) => [Type] extends [readonly (infer Item)[] | null | undefined]
    ? ListResolveValue<Type, Item, Return>
    : MaybePromise<Type>;
  ```
  So the four positional args are exactly `(parent, args, context, info)`. The page's
  order `(parent, args, ctx, info)` (`resolvers.mdx:20`) matches.
- **[verified] 4th arg is graphql-js `GraphQLResolveInfo`**: `info` is typed
  `GraphQLResolveInfo`, imported from `'graphql'` at
  `packages/core/src/types/builder-options.ts:1`
  (`import type { GraphQLResolveInfo } from 'graphql';`). This is the genuine
  graphql-js type, not a Pothos re-declaration.
- **[verified] Subscribers share the shape**: `Subscriber<Parent, Args, Context, Shape>`
  is `(parent, args, context, info: GraphQLResolveInfo) => MaybePromise<AsyncIterable<Shape>>`
  — `builder-options.ts:82-87`. Same four args.

### Where the resolver is wrapped/assembled (invocation-adjacent)
- `packages/core/src/build-cache.ts:343`:
  `const resolve = this.plugin.wrapResolve(config.resolve ?? defaultFieldResolver, config);`
  — every field's resolve goes through the (possibly merged) plugin `wrapResolve`.
  `defaultFieldResolver` is imported from `'graphql'` (`build-cache.ts:1-24`, name at
  line 2).
- Plugins compose via `MergedPlugins.wrapResolve`, which folds each plugin's
  `wrapResolve` around the next: `packages/core/src/plugins/merge-plugins.ts:68-76`
  (`reduce((nextResolve, plugin) => plugin.wrapResolve(nextResolve, fieldConfig), ...)`).
  With no plugins loaded, the identity `wrapResolve` (§0) means the user's resolve
  reaches graphql-js untouched.
- **Parent for root fields**: the page says parent is "whatever you passed as
  `rootValue`, usually undefined" (`resolvers.mdx:22`). This is **graphql-js**
  behavior (the `rootValue` argument to `execute`), not something Pothos sets —
  Pothos does not inject a rootValue. **[verified as not-Pothos]** grep of
  `packages/core/src` shows no rootValue assignment; the emitted schema leaves it to
  the server's `execute` call. Statement is correct but server-determined.

---

## 2. `info` — what it is and whether the ORM-plugin claim is honest

`info` is graphql-js's `GraphQLResolveInfo`: the live execution context for this
field — the selection set (`fieldNodes`), the return type (`returnType`), the schema
(`schema`), fragments (`fragments`), the response path (`path`), and the parent type
(`parentType`). Pothos passes it straight through (§1).

### VERDICT: the "ORM plugins use info to plan ahead" claim is TRUE — keep the paragraph.

The page claims (`resolvers.mdx:25`) "ORM plugins like Prisma and Drizzle use it to
plan ahead." This is **[verified]** against real plugin source — both ORM plugins
read the GraphQL selection set out of `info` and compile it into a database
`select`/`include` so nested relations load in one query:

- **plugin-prisma** — `queryFromInfo(...)` is the query planner. It reads
  `info.returnType`, `info.schema`, and `info.fieldNodes[0]` to build the Prisma
  selection: `packages/plugin-prisma/src/util/map-query.ts:445` (function start),
  `map-query.ts:474-475` (`getNamedType(info.returnType)` / `info.schema.getTypeMap()`),
  `map-query.ts:488,527` (`info.fieldNodes[0]`), and it walks fragments via
  `info.fragments[...]` (`map-query.ts:179-181,239-248`). The field builder calls into
  it and inspects `info.fieldNodes` / `info.returnType` directly:
  `packages/plugin-prisma/src/field-builder.ts:161-165`
  (`const returnType = getNamedType(info.returnType); ... const selections = info.fieldNodes;`).
- **plugin-drizzle** — identical shape: its resolvers take
  `(parent, args, context, info: GraphQLResolveInfo)` and call the same-named
  `queryFromInfo`: `packages/plugin-drizzle/src/field-builder.ts:32-35` and `:73-76`
  (`import { queryFromInfo } from './utils/map-query'`, line 10), and read
  `info.returnType` / `info.fieldNodes` at `field-builder.ts:138,142` and
  `drizzle-field-builder.ts:352-355`. The model loader derives selections from info
  via `selectionStateFromInfo` / `stateFromInfo`
  (`packages/plugin-drizzle/src/model-loader.ts:14,94`).

So `info.fieldNodes` (the selection set) is the load-bearing field: both plugins use
it to know *which columns/relations the client asked for* before touching the DB.
This is a real, citable use of `info` for query planning — the mention is honest and
should stay as a real sentence, not be cut.

**Application-code `info` usefulness** beyond ORM plugins is genuinely marginal — the
page's "rarely useful in application code" (`resolvers.mdx:25`) is a fair
characterization; core itself only forwards it.

---

## 3. What a resolver may return

- **[verified] Sync value or promise** — the return type is `MaybePromise<Type>`
  (`builder-options.ts:51`), and `MaybePromise<T> = Promise<T> | T`
  (`packages/core/src/types/utils.ts:3`). So returning the value directly or
  returning a promise are both type-legal; the page's "Sync, async, both"
  (`resolvers.mdx:33-35`) is accurate at the type level.
- **[verified] List fields accept arrays / iterables / async iterables of maybe-promises**
  — `ListResolveValue` (`builder-options.ts:49-64`, with `ArrayResolverResult`
  `:66-72`) permits `MaybePromise<readonly MaybePromise<Item>[]>` and iterable/async-
  iterable forms. Practical takeaway: you may return an array of promises.
- **Object fields return the backing model, not a GraphQL-shaped object** — this is a
  type-inference fact owned by the backing-models dossier; the page's framing
  (`resolvers.mdx:55-72`) is consistent with it (the resolve return type is the
  ref's backing shape). **[verified as consistent]**, mechanism cited elsewhere.
- **undefined vs null** — the page does not spell this out; the honest statement is
  **graphql-js semantics, not Pothos**: for a nullable field both `undefined` and
  `null` complete to `null`; for a non-null field a nullish return triggers
  graphql-js's non-null error propagation (nearest nullable ancestor becomes null).
  Pothos does not intercept either case (§0). **[verified as not-Pothos]** — no
  null/undefined normalization exists in the field-resolve path of `build-cache.ts`.

---

## 4. Default resolver + `expose*` mechanics (field with no `resolve`)

- **[verified] No `resolve` ⇒ graphql-js `defaultFieldResolver`**: `build-cache.ts:343`
  substitutes `config.resolve ?? defaultFieldResolver`. Then `build-cache.ts:358`
  sets `resolve: resolve === defaultFieldResolver ? undefined : resolve` — i.e. when
  nothing (no user resolve, no plugin wrapping) changed it, Pothos emits `resolve:
  undefined` so graphql-js falls back to its **own** built-in default resolver
  (reads `parent[fieldName]`, calling it if it's a function). Net: a field with no
  resolver reads the same-named property off the parent.
- **[verified] `t.expose*` builds a property-reading resolver**: `exposeField`
  (`packages/core/src/fieldUtils/base.ts:93-112`) creates a field with
  `resolve: (parent) => (parent as Record<string, never>)[name]` (`base.ts:110`) and
  tags it `extensions.pothosExposedField: name` (`base.ts:107`).
- **[verified] Same-name expose is optimized to the graphql-js default**: in
  `createField`, if `options.extensions?.pothosExposedField === name` (the *schema
  field* name), the closure resolver is discarded and replaced with
  `defaultFieldResolver`: `base.ts:57-61`. So `t.exposeString('firstName')` registered
  as field `firstName` → uses graphql-js default (and per `build-cache.ts:358` emits
  `resolve: undefined`); registered under a *different* field name (e.g. field `name`
  exposing property `firstName`) → keeps the `(parent) => parent['firstName']` closure.
  Either way the observable result is "read that property off the backing model."
- The typed `exposeString/exposeInt/exposeID/... /expose` helpers all delegate to
  `exposeField`: `packages/core/src/fieldUtils/builder.ts:164-191` (`exposeString`),
  `:374-407` (generic `expose`), et al.

---

## 5. Error behavior on throw

- **[verified] Pothos wraps nothing by default** — base `wrapResolve` is identity
  (`plugin.ts:104-109`, §0), and there is no try/catch around the field resolver in
  `build-cache.ts`. A throw therefore propagates into the **graphql-js executor**,
  which is what produces the `null` value + `errors[]` entry and applies non-null
  propagation. The page's own line "That's GraphQL's default behavior, not
  Pothos-specific" (`resolvers.mdx:80`) is **correct**.
- Message masking / typed error unions are opt-in and live outside core
  (`plugin-errors`); the page correctly defers to `patterns/handling-errors`
  (`resolvers.mdx:80,83`). Nothing in `packages/core/src` masks or rewrites thrown
  messages.

---

## 6. Page claim inventory — `fundamentals/resolvers.mdx`

| Line | Claim | Verdict |
|---|---|---|
| `:8`, `:20` | "hands it four arguments … `(parent, args, ctx, info)`" | **[verified]** `builder-options.ts:44-48`. |
| `:22` | root-field `parent` is `rootValue`, "usually undefined" | **[verified as graphql-js/server behavior]** — true, but set by the server's `execute` call, not by Pothos. Not Pothos-specific. |
| `:23` | `args` "fully type-checked against the `args:` declaration" | **[verified as type-level]** — the `Args` generic on `Resolver` is the field's arg map. |
| `:24` | `ctx` is the per-request context | **[verified]** — 3rd arg; see context.md. |
| `:25` | `info` "ORM plugins like Prisma and Drizzle use it to plan ahead" | **[verified — KEEP]** `map-query.ts:445`, prisma `field-builder.ts:161-165`, drizzle `field-builder.ts:32-35`. §2. |
| `:35` | "**Pothos** awaits whatever you return" | **MISATTRIBUTION (behavior OK)** — the **graphql-js executor** awaits; Pothos's `wrapResolve` is identity (`plugin.ts:108`). Observable result identical; wording overstates Pothos's role. |
| `:44` (comment) | "Async — **Pothos** handles the awaiting" | **MISATTRIBUTION** — same as `:35`. Prefer "GraphQL awaits" / "the executor awaits." |
| `:53` | "Pothos enforces this in TypeScript" | **[verified]** — the resolve return type is constrained by the field's `Type` generic (`builder-options.ts:49-51`). Compile-time only. |
| `:57-72` | object resolvers return the backing model, Pothos projects | **[verified as consistent]** — mechanism owned by backing-models dossier. |
| `:76` | throw ⇒ `null` for the field + `errors[]` entry; message reaches client unless masked | **[verified as graphql-js]** — §5. Pothos adds no wrapping. |
| `:80` | "That's GraphQL's default behavior, not Pothos-specific" | **[verified] — correct attribution.** |

**No factually WRONG claim.** The only defect is the two **misattributions** at
`:35` and the `:44` comment ("Pothos awaits/handles the awaiting") — the awaiting and
the throw-catching are done by the graphql-js executor, not by Pothos (base
`wrapResolve` is identity, no await/try-catch in the core field path). Behavior
described is correct; the agent should soften "Pothos" → "GraphQL/the executor" for
honesty.

---

## 7. Summary of findings (8 lines)

- Signature `(parent, args, context, info)` is **[verified]** at
  `builder-options.ts:44-48`; the 4th arg `info` is genuine graphql-js
  `GraphQLResolveInfo` (`builder-options.ts:1`).
- Pothos does **not** invoke or await resolvers — it emits a `GraphQLSchema`; base
  `wrapResolve` is identity (`plugin.ts:104-109`); no try/catch or await in the field
  path of `build-cache.ts`.
- Resolvers may return `MaybePromise<Type>` (`utils.ts:3`, `builder-options.ts:51`);
  undefined/null handling and throw→null+errors are pure **graphql-js** semantics,
  not Pothos.
- No-`resolve` fields fall back to graphql-js `defaultFieldResolver`
  (`build-cache.ts:343,358`); `t.expose*` builds a `parent[name]` reader
  (`base.ts:93-112`), optimized to the default when names match (`base.ts:57-61`).
- **info VERDICT: KEEP the ORM-plugin sentence — it is honest.** Both plugins read
  `info.fieldNodes`/`info.returnType`/`info.schema` to plan the DB query:
  `plugin-prisma/src/util/map-query.ts:445`, `field-builder.ts:161-165`;
  `plugin-drizzle/src/field-builder.ts:32-35,138-142`.
- **Current-page WRONG/needs-fix**: none factually wrong; two **misattributions** —
  "Pothos awaits whatever you return" (`resolvers.mdx:35`) and "Pothos handles the
  awaiting" (`:44` comment) should credit graphql-js/the executor.
- Everything else on the page (four args, args typing, throw→null+errors, backing
  model, "GraphQL's default behavior") is **[verified]**.
- Error masking / typed unions are opt-in (`plugin-errors`), outside core; page's
  deferral to `patterns/handling-errors` is correct.
