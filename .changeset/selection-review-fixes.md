---
'@pothos/selection-mapper': patch
'@pothos/plugin-drizzle': minor
'@pothos/plugin-prisma': patch
---

Keep nested fallback selections scoped to their field execution so sibling rows with different
plans retain their own pagination options. Cached Prisma fallback plans record mappings at the
current row's execution path, and heterogeneous Relay node lists retain each model's mappings.

The Drizzle client contract now requires the methods used at runtime: `select()` and its SQL
builder chain, plus `query.<table>.findMany()`, alongside relation metadata and `$count()`.
Custom adapters must forward `select` synchronously and expose a typed query proxy; full Drizzle
clients already provide these methods. Do not wrap SQL construction in a promise or Effect.
Related counts fall back to a target-table count when the only unique key is nullable, so rows
with null keys are included.

Prisma model-name lookups can reference an existing interface without triggering the
object/interface registration guard. Related connections preserve rows consumed by custom
connection fields when `totalCount` is also selected.
