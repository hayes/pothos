---
'@pothos/plugin-drizzle': patch
---

Drizzle plugin fixes.

- `t.relatedConnection` calls its `query` callback with the same `pathInfo` while resolving as
  while planning, so a query that branches on `pathInfo` pages the rows it selected.
- `t.relatedConnection` no longer accepts a `resolve` option. It was silently discarded, so the
  resolver never ran.
- `t.relation` evaluates a `query` callback once, with `pathInfo`. Previously it was called a
  second time without `pathInfo`.
- `drizzleConnectionHelpers(builder, table)` can now be called without the options argument.
  Previously it threw.
- `builder.drizzleInterfaceField(s)` given a table name resolves it to the interface registered for
  that table, as the docs describe, instead of the object type.
- `pathInfo.path` handed to relation `query` callbacks now starts with the root field for queries
  planned through `path`/`paths`, as it already did for queries planned directly for a field.
- `pathInfo.segments[].isList` is `true` for non-null list fields (`[Post!]!`). Previously only
  nullable lists were reported as lists.
- The error for a `drizzleObject` and a `drizzleInterface` it implements being built on different
  tables names drizzle rather than prisma. It read "must be based on the same prisma model as any
  DrizzleInterfaces they extend"; it now says "the same drizzle table".
- Custom client adapters must now provide `select()` and its SQL builder chain, plus
  `query.<table>.findMany()`, alongside relation metadata and `$count()`. Forward SQL construction
  synchronously; do not wrap `select` in a promise or Effect. Full Drizzle clients already
  provide these methods.
