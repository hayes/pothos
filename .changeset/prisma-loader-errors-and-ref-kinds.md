---
'@pothos/plugin-prisma': patch
---

Two fixes for errors the prisma plugin swallowed rather than reported.

- A model load that failed before its query was sent hung the request instead of returning an
  error. The loader batches the rows it reloads and sends one query per row on the next tick; a
  throw while building any of those queries — most reachably `findUnique: null`, which throws
  `Missing findUnique for <type>` — abandoned every row it had not reached yet, so those fields
  never resolved and never errored and the request never finished. Every row in the batch now
  rejects with that error, matching what `@pothos/plugin-drizzle` already did.
- Registering the same prisma model as both an object and an interface silently returned the
  first ref for both. `builder.prismaInterface('User', ...)` after `builder.prismaObject('User',
  ...)` (in either order) handed back the ref that was created first, typed as the kind that was
  asked for. It now throws, naming the model and pointing at `variant`, the way
  `@pothos/plugin-drizzle` does for tables. `builder.prismaInterfaceField(s)` given a model name
  also names that model's interface now, rather than its object.
