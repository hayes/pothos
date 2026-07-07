# Dossier: Context (fundamentals/context) — declaration, consumption, initContextCache

Territory: the `fundamentals/context` page — how `Context` is declared on the
`SchemaTypes` generic and consumed as the third resolver arg, what
`initContextCache` / `createContextCache` actually do, the context-narrowing idiom,
the fact that Pothos never creates context (the server does), and the near-duplicate
context-factory prose in `getting-started/first-server.mdx` that this page should own.

All citations are repo-relative from the worktree at `.../scratchpad/pg-audit/`.

Convention: **[verified]** = confirmed against repo source (or a repo test as
behavior evidence); **[UNVERIFIED]** = not provable from repo code read here.

Page sources: `website/content/docs/fundamentals/context.mdx` and
`website/content/docs/getting-started/first-server.mdx` (§"The context factory").

---

## 1. How Context is declared and consumed

- **[verified] Declared on `SchemaTypes`**: `Context` is a key on the base
  `SchemaTypes` interface, defaulting to `object`:
  `packages/core/src/types/schema-types.ts:32` (`Context: object;`). You override it
  via the builder generic — `new SchemaBuilder<{ Context: MyContext }>({})`.
  (Default-`object` proof also cited in first-server.md §3.)
- **[verified] Consumed as the 3rd resolver argument**: the `Resolver` type's third
  parameter is `context: Context` —
  `packages/core/src/types/builder-options.ts:44-47`. Whatever you declare in the
  `Context` slot is the static type of `ctx` in every resolver. The page's "Every
  resolver receives it as the third argument … Pothos infers its shape from the
  `Context` slot of the builder generic" (`context.mdx:8`) is **[verified]**.
- The type "travels through the whole schema for free" because there is exactly one
  `Context` type on `SchemaTypes`, threaded into every field builder's `Resolver`
  instantiation. No per-resolver annotation is needed.

---

## 2. Pothos does NOT create or invoke a context factory — the server does

- **[verified]** There is **no** context factory, `createContext`, or context
  instantiation anywhere in `packages/core/src`. A grep for
  `contextFactory|createContext|new Context|context()` across `packages/core/src`
  (excluding the unrelated `createContextCache`/`initContextCache`/`contextCache`
  identifiers) returns **nothing**. Core only *types* the context (`Types['Context']`)
  and forwards the value graphql-js hands it — e.g. the type resolver forwards
  `context` at `packages/core/src/build-cache.ts:578,611,626,629`.
- The context object is created by the **server** (yoga/Apollo/etc.) and passed into
  `execute` as `contextValue`; graphql-js then passes it as the 3rd arg to every
  resolver. So the page's "Pothos doesn't care how the factory works — only that its
  return type matches what you declared" (`context.mdx:38`) is **[verified]**.

---

## 3. `initContextCache` / `createContextCache` — what they ACTUALLY do

Both live in `packages/core/src/utils/context-cache.ts` and are re-exported from the
package root (`packages/core/src/utils/index.ts:24` → `packages/core/src/index.ts:49`
`export * from './utils'`), so `import { initContextCache } from '@pothos/core'` is
the public entry.

- **`initContextCache()`** (`context-cache.ts:3-7`) returns a small object carrying a
  single shared slot:
  ```ts
  export const contextCacheSymbol = Symbol.for('Pothos.contextCache');   // :1
  export function initContextCache() {
    return { [contextCacheSymbol]: {} };                                  // :4-6
  }
  ```
  You spread `...initContextCache()` into your context object.
- **`createContextCache(create)`** (`context-cache.ts:14-40`) returns a memoizer
  backed by a `WeakMap`:
  ```ts
  const cache = new WeakMap<object, T>();                                 // :17
  const getOrCreate = (context, ...args) => {
    const cacheKey = context[contextCacheSymbol] || context;             // :20
    if (cache.has(cacheKey)) return cache.get(cacheKey);                 // :22-24
    const entry = create(context, ...args);                             // :26
    cache.set(cacheKey, entry);                                         // :28
    return entry;
  };
  ```
  The **cache key is `context[contextCacheSymbol]` if present, otherwise the context
  object itself** (`context-cache.ts:20`). That indirection is the entire point of
  `initContextCache`: it pins the cache key to a stable inner `{}` rather than to the
  outer context object's identity.

### What it's genuinely for / what breaks without it
- Pothos plugins memoize per-request data on the context via `createContextCache`.
  Core itself does this for plugin request-data: `BasePlugin.requestDataMap =
  createContextCache((ctx) => this.createRequestData(ctx))`
  (`packages/core/src/plugins/plugin.ts:31-33`). The dataloader plugin stores its
  loaders the same way: `packages/plugin-dataloader/src/util.ts:15` (the per-request
  loader set), `:75` and `:92` (per-ref loader maps) all via `createContextCache`.
- **Without `initContextCache`**, the cache key falls back to the context **object
  identity** (`context-cache.ts:20`). That is fine *as long as the exact same context
  object reaches every resolver*. It **breaks if the server copies / extends /
  re-wraps the context** between creating it and running resolvers: each copy is a
  new WeakMap key, so dataloaders (and other per-request caches) get **recreated**,
  destroying batching/deduplication. Spreading `initContextCache()` gives every copy
  the same `contextCacheSymbol` slot, so they share one cache.
- The repo's own docs state exactly this rationale:
  `website/content/docs/plugins/dataloader.mdx:164` ("`initContextCache` keeps the
  loaders consistent if your server copies the context before resolving") and the
  inline comment at `dataloader.mdx:183` ("Prevents duplicate loaders if the server
  extends the context object").
- **Behavior evidence (test)**: `packages/plugin-dataloader/tests/example/context.ts`
  spreads `...initContextCache()` into a per-request context whose getters call
  `Ref.getDataloader(context)` (`context.ts:8-35`, spread at `:13`). This is the
  canonical wiring the plugin is tested against.
- **Relationship to dataloader**: `initContextCache` is *not* itself a dataloader and
  does not batch anything. It only makes the WeakMap-keyed per-request memoization
  robust to context copying. The dataloader plugin is the primary consumer that
  benefits (one loader per request instead of per context-copy).
- **GC**: because `createContextCache` uses a `WeakMap` (`context-cache.ts:17`),
  entries are eligible for garbage collection once the context (or its
  `contextCacheSymbol` slot) is unreferenced — i.e. after the request. The page's
  "garbage-collected when the request ends" (`context.mdx:42`) is broadly **[verified]**
  (WeakMap semantics), though GC timing is not guaranteed to be "at request end."

### VERDICT: KEEP — two honest sentences + link.
`initContextCache` is real, exported, and load-bearing for the dataloader plugin. It
should be covered in ~2 sentences, e.g.: *"Pothos plugins cache per-request values
(like dataloaders) in a WeakMap keyed on your context object. Spreading
`...initContextCache()` into your context adds a stable shared key so those caches
survive if your server copies or extends the context between creating it and running
resolvers."* Link to `plugins/dataloader`. Do **not** cut it, but do fix the framing
(see §5 on `context.mdx:42`).

---

## 4. The context-narrowing idiom (does it type-check conceptually?)

- The page teaches (`context.mdx:50-58`): lift the auth check to the top of the
  resolver so TypeScript narrows `ctx.viewer` for the rest of the body:
  ```ts
  resolve: (_root, args, ctx) => {
    if (!ctx.viewer) throw new Error('Sign in to continue');
    // ctx.viewer is { id: number } from here down.
    return ctx.db.drafts.findMany({ authorId: ctx.viewer.id });
  }
  ```
- **[verified conceptually]** This is standard TypeScript control-flow narrowing: if
  `viewer` is typed `{ id: number } | undefined` (as the page's example context
  declares — `context.mdx:12`), a truthiness guard that `throw`s on the falsy branch
  narrows `ctx.viewer` to `{ id: number }` below the guard. The idiom is sound; no
  Pothos-specific machinery involved. (It relies only on `Context` being the declared
  static type of `ctx`, which §1 verifies.)

---

## 5. Page claim inventory — `fundamentals/context.mdx`

| Line | Claim | Verdict |
|---|---|---|
| `:8` | context is 3rd resolver arg; shape inferred from `Context` builder generic | **[verified]** `builder-options.ts:44-47`, `schema-types.ts:32`. |
| `:12` | `ctx.viewer` is `{ id: number } \| undefined` everywhere, no casts | **[verified as type behavior]** — single `Context` type threads everywhere (§1). |
| `:26` | "The context factory runs once per request." | **[UNVERIFIED from core / server-owned]** — Pothos never runs a factory (§2); the once-per-request cadence is the **server's** (yoga's) behavior, not provable from core. Same caveat as first-server.md Claim E. |
| `:38` | "the server awaits it before resolvers run. Pothos doesn't care how the factory works" | **[verified]** — core never invokes/creates context (§2). |
| `:42` | "This is the invariant `initContextCache` relies on … per-request caches live on `ctx` and are garbage-collected when the request ends." | **IMPRECISE FRAMING (fix).** The WeakMap-GC half is fine (§3). But `initContextCache` does **not** "rely on each request getting its own object" — its purpose is the *opposite*: to keep caching stable **when the context object is NOT stable** (server copies/extends it), by pinning a shared `contextCacheSymbol` key (`context-cache.ts:20`, `dataloader.mdx:164`). The sentence inverts why the helper exists. |
| `:52-56` | narrowing idiom (`if (!ctx.viewer) throw`) narrows `ctx.viewer` | **[verified conceptually]** — §4. |

**No claim is flatly WRONG, but `:42` is misframed** — it presents `initContextCache`
as depending on per-request context identity, when the helper exists precisely to
survive context *copying*. Recommend rewording per §3 VERDICT.

---

## 6. Consolidation: what `first-server.mdx` §"The context factory" currently covers

`getting-started/first-server.mdx:50-64` (the near-duplicate prose the curriculum
wants this page to own). It covers, at an intro level:

- **`:52`** — "The `context` option is a function that runs while yoga handles a
  request; whatever it returns becomes the `ctx` value every resolver can read." Also
  notes the page's earlier server returns `{}`, so `ctx` is empty. *(Same idea as
  `context.mdx:26,40-42`.)*
- **`:54-62`** — a code fence: `createYoga({ schema, context: async ({ request }) =>
  ({ user: await getUser(request.headers.get('authorization')), db }) })`. *(Nearly
  identical to `context.mdx:28-36`, which uses `viewer`/`decodeViewerFromToken`
  instead of `user`/`getUser`.)*
- **`:64`** — "Declaring a matching `Context` type on the builder makes `ctx` fully
  typed in every resolver," then links to the Context guide for "what belongs on
  context and how to wire the types." *(Same point as `context.mdx:8`.)*

**Overlap / consolidation guidance**: the two pages teach the same three beats —
(a) the factory runs per request and its return becomes `ctx`, (b) an async factory
reading the request and returning `{ viewer/user, db }`, (c) declaring `Context` on
the builder generic types `ctx` everywhere. The Context page already owns (a) and (c)
more fully and adds "what to put on it," the per-request rationale, `initContextCache`,
and narrowing. So the Context page can **own the full teaching**; `first-server.mdx`
should shrink its §"context factory" to a one-line pointer (keep just enough to show
`context:` exists on `createYoga`, then link here). The only detail unique to
first-server is that it ties the factory to the concrete yoga server it just built —
retain a single sentence of that, drop the duplicated async-factory fence.

---

## 7. Summary of findings (8 lines)

- `Context` is a `SchemaTypes` key defaulting to `object` (`schema-types.ts:32`);
  it's consumed as the 3rd resolver arg (`builder-options.ts:44-47`). **[verified]**
- Pothos **never** creates or invokes a context factory — grep of `packages/core/src`
  finds no context instantiation; core only forwards the value graphql-js passes
  (`build-cache.ts:578,611`). The server owns context creation. **[verified]**
- `initContextCache()` (`context-cache.ts:3-7`) adds a stable
  `Symbol.for('Pothos.contextCache')` slot; `createContextCache` (`:14-40`) memoizes
  in a WeakMap keyed on `context[symbol] || context` (`:20`).
- **initContextCache VERDICT: KEEP (2 sentences + link).** It's real, exported, and
  used by core (`plugin.ts:31`) and the dataloader plugin (`util.ts:15,75,92`).
  Without it, caches key on context *identity* and break when the server
  copies/extends the context (`dataloader.mdx:164`).
- The narrowing idiom (`if (!ctx.viewer) throw`) type-checks conceptually — plain TS
  control-flow narrowing on an optional field (§4). **[verified conceptually]**
- **Current-page issue**: `context.mdx:42` is **misframed** — it says
  `initContextCache` relies on each request having its own context object, but the
  helper exists to survive context *copying* (the inverse). Reword per §3.
- `context.mdx:26` "factory runs once per request" is server-owned cadence,
  **[UNVERIFIED from core]** — keep as prose, don't cite to Pothos.
- Consolidation: `first-server.mdx:50-64` duplicates the async-factory fence and the
  "declare Context on the builder" point; the Context page should own it, and
  first-server should shrink to a one-line pointer.
