---
"@pothos/plugin-prisma-next": minor
---

Initial release of `@pothos/plugin-prisma-next` — a Pothos plugin for the new
`prisma-next` ORM client.

Built against `@prisma-next/* @ ^0.14.0` (the first published prisma-next line).
Note that `IncludeRefinementResult` is no longer re-exported: prisma-next 0.14.0
made it internal and it cannot be faithfully reconstructed (it is branded with a
module-private symbol). `IncludeRefinementCollection` and `IsToManyRelation`
remain available.

What ships:

- `builder.prismaObject` / `prismaInterface` / `prismaNode` — register contract
  models as GraphQL types, with full inference from `Types['PrismaNextContract']`.
- `t.exposeID/String/Int/Float/Boolean[List]` — typed against the model's row.
- `t.relation` — autocompleted relation names, cardinality-aware nullability,
  typed `query` refinement callback. Resolves N:M (junction) relations
  directly: prisma-next 0.14.0 emits the junction join internally from the
  contract's `through` block, so no explicit join model is needed in the schema.
- `t.relationCount` / `t.relationAggregate` — expose a relation's row count or a
  `sum`/`avg`/`min`/`max` reducer as a numeric field, with an optional `where`
  refine (literal or accessor callback with args in scope). Compile to the same
  function-form `select` primitive (`sub.count()` / `sub.sum('field')` / …).
- `t.prismaField` — entry-point root field; the resolver receives an `apply`
  callable bound to the resolve site (`<C>(c: C) => C`). Pipe your own
  Collection (`ctx.db.orm.User`, …) through `apply(...)` to get the
  auto-include mapper applied based on the GraphQL selection.
- `prismaNode` with plural `load(apply, ids, ctx)` callback — calls at the
  same `pathKey(info.path)` batch into one user `load()` invocation.
- `t.field({ select, resolve })` — `select` narrows the parent shape inside
  `resolve` to just the declared columns.
- Auto-include walker — collapses sibling-aliased relations into one
  `combine({...})` call; descends into `edges.node` for nested includes inside
  connections; alias-aware so GraphQL query-level aliases of the same schema
  field with different args route correctly.
- `t.prismaConnection` / `t.relatedConnection` — Relay cursor pagination over
  prisma-next models. Single or compound (lexicographic) cursors. The related
  variant hoists into the parent's `prismaField` collection via
  `.include('rel', cb => cb.where(cursor).orderBy(cursor).take(limit + 1))`.
- `prismaConnectionHelpers` — escape hatch for users who need a connection inside
  a custom `t.connection` resolver.
- Real-runtime tests against an on-disk sqlite database via `@prisma-next/sqlite`.
