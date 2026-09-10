---
'@pothos/selection-mapper': minor
---

An ORM adapter is now a class rather than a pair of objects wired together. `Adapter` carries the
whole contract — `modelFor`, `typeSelection` and `fieldSelection` to translate a schema, `create`,
`merge` and `emit` to accumulate — and the four merge rules that used to be optional members of a
separate `Accumulator` are inherited method bodies holding the answers the package used to supply
on their behalf. `TreeAdapter` replaces `treeAccumulator(format)`: it implements those four over
the shared query tree and leaves `read` and `emit` to the subclass, so `QueryFormat` and
`Accumulator` are gone, as are the `absorb`, `accepts`, `acceptsFrom` and `conflictOf`
pass-throughs, `treeAccumulator`, `createNode`, `relation` and `play`.

A `Plan` is likewise a class, owning its merges, its pending chain and its own fold: `play`,
`query`, `settle`, `nested`, `collect`, `chain`, `abandon` and `finish` are methods where they
were free functions taking a plan.

Nothing a schema does changes. The package is an implementation detail of the prisma and drizzle
plugins, whose public API is unaffected.
