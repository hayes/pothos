---
'@pothos/plugin-prisma': minor
---

Await async node ID resolvers before building a custom `findUnique`'s where.

`prismaNode`'s `id.resolve` is typed `MaybePromise`, but the fallback lookup handed its return
value straight to a custom `findUnique`. An async resolver meant the callback received a promise
where its own type promised a string, so `findUnique: (id) => ({ id: Number(id) })` built
`where: { id: NaN }` and the row failed to load. The model loader now waits for the where before
issuing the lookup, guarded so a synchronous resolver still issues its query in the same
microtask and batching is unchanged. A `findUnique` of your own may now return a promise.
