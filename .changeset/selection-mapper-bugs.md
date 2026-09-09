---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

Fix several bugs in how relation selections are mapped and loaded.

Prisma:

- A relation `query` returning keys set to `undefined` (`{ where: cond ? filter : undefined }`) is now treated as compatible with a sibling selection of the same relation. Previously the sibling fell back to a separate query per row whenever the condition was false.
- `onNull` now receives `args`, `context`, and `info`. Previously it was called with empty objects, so any callback reading them threw at runtime.
- When a relation field is loaded through the fallback query, every occurrence of the field under the same response key (for example the same relation selected again inside a fragment) is planned, not only the first.

Drizzle:

- `totalCount` on `t.relatedConnection` now applies the `where` returned by the field's `query`, so it counts the same rows the connection paginates. Previously it reported the unfiltered count.
- New builder option `drizzle.filterConnectionTotalCount` (default `true`). Set it to `false` to keep counting every related row regardless of the filter, matching the prisma plugin's option.
- `t.relatedConnection` no longer accepts a `resolve` option. It was silently discarded, so the resolver never ran.
- `drizzleConnectionHelpers(builder, table)` can now be called without the options argument. Previously it threw.
- `t.relation`, `t.relatedCount`, and `t.relatedConnection` now load their data through the model loader when the parent row was returned by a resolver that fetched it itself, instead of returning `undefined` or an empty page.
- `t.relatedField` (and so `t.relatedCount`) now forwards every field option and merges `extensions` instead of dropping them.
- `t.relatedConnection` reads its selection at resolve time the same way the planner does (through fragments, `@skip`/`@include`, and a wrapping type). A count-only selection written through a fragment no longer crashes, and a parent row that carries the relation rows but not the count is reloaded instead of resolving `totalCount` as `undefined`.
- `t.relation` evaluates a `query` callback once, with `pathInfo`. Previously it was called a second time without `pathInfo`.
- Every occurrence of a field under the same response key is planned when it is loaded through the fallback, not only the first.
- `pathInfo.segments[].isList` is `true` for non-null list fields (`[Post!]!`). Previously only nullable lists were reported as lists.
