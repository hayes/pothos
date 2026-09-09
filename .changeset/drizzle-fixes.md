---
'@pothos/plugin-drizzle': patch
---

Drizzle plugin fixes.

- `t.relation`, `t.relatedCount`, and `t.relatedConnection` now load their data through the model loader when the parent row was returned by a resolver that fetched it itself, instead of returning `undefined` or an empty page.
- `t.relatedConnection` reads its selection at resolve time the same way the planner does (through fragments, `@skip`/`@include`, and a wrapping type). A count-only selection written through a fragment no longer crashes, and a parent row that carries the relation rows but not the count is reloaded instead of resolving `totalCount` as `undefined`.
- `t.relatedConnection` calls its `query` callback with the same `pathInfo` while resolving as while planning, so a query that branches on `pathInfo` pages the rows it selected.
- `t.relatedConnection` no longer accepts a `resolve` option. It was silently discarded, so the resolver never ran.
- `t.relation` evaluates a `query` callback once, with `pathInfo`. Previously it was called a second time without `pathInfo`.
- `t.relatedField` (and so `t.relatedCount`) now forwards every field option and merges `extensions` instead of dropping them.
- `drizzleConnectionHelpers(builder, table)` can now be called without the options argument. Previously it threw.
- `builder.drizzleInterfaceField(s)` given a table name resolves it to the interface registered for that table, as the docs describe, instead of the object type.
- `pathInfo.path` handed to relation `query` callbacks now starts with the root field for queries planned through `path`/`paths`, as it already did for queries planned directly for a field.
- `pathInfo.segments[].isList` is `true` for non-null list fields (`[Post!]!`). Previously only nullable lists were reported as lists.
- The unused `withUsageCheck` option on the internal `queryFromInfo`, and the commented-out call sites for it, are removed: a drizzle resolver is handed a query builder function, so the prisma-style check that observes reads on a query object cannot see the realistic mistake (never calling `query()`).
