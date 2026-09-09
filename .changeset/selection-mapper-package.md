---
'@pothos/selection-mapper': minor
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

Move the selection planner shared by the prisma and drizzle plugins into a new internal package, `@pothos/selection-mapper`, and fix three things on the way.

- A relation selected under both `nodes` and `edges { node }` of a connection is now answered from the loaded rows in both places. The loader mappings used to be keyed by field alias alone, so the second path (or the same field planned for two types of the same model) fell back to a query of its own.
- (prisma) A connection whose document selects neither `nodes` nor `edges { node }` (only `pageInfo`, say) now loads only the cursor columns of the related rows instead of every column.
- (prisma) `_count: true` in a type-level or field-level `select` is kept and passed to prisma as `_count: true`; it is spelled out per list relation only when a filtered named count has to be selected alongside it.
- (drizzle) `t.relatedConnection` now calls its `query` callback with the same `pathInfo` while resolving as while planning, so a query that branches on `pathInfo` pages the rows it selected.

The plugins' public API is unchanged; only the internal `map-query`/`selections` helpers moved, and the loader mapping keys (internal) now carry the full path.
