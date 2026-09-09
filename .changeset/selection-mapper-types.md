---
'@pothos/selection-mapper': patch
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

Type the selection API by what it does, and document what was undocumented.

- `queryFromInfo` (prisma) is typed by what it was given: `{ select }` or `{ include }` when one
  was passed, and otherwise `{ select?, include? }`, whichever the type's mode produced. It used
  to claim `{ select: Select }` for every call without `include`.
- `nestedSelection` returns the relation query for the field's model or table (prisma:
  `PrismaRelationQuery<Model>`; drizzle: the table's `DBQueryConfig`, a `many` config for a list
  field), keeping the keys it was given as given, so a `select`/`columns` in them still narrows
  the parent shape. Its argument is typed by that query when the field's type names a model, so
  literals such as `select: { title: true }` are kept. It used to return its argument's type.
- One `PathSegment` type (`string | { name: string; type?: string }`) for `queryFromInfo` paths
  and `nestedSelection` paths, exported from `@pothos/selection-mapper` and re-exported by both
  plugins, together with `IndirectPathSegment` (its `{ name, type? }` form) and `IndirectInclude`,
  whose `path`/`paths` still take only `IndirectPathSegment` objects. A `{ name, type }` segment
  given to `nestedSelection` now pins the implementation the field is found under at runtime, as
  it already did for `queryFromInfo`.
- The `query` a `t.relation` fallback `resolve` receives (prisma) carries the relation's own
  arguments (`where`, `orderBy`, `take`, ...) alongside the planned `select`/`include`, so it
  spreads into a prisma call without a cast. Exported as `QueryFromRelation`.
- `t.relationCount` (prisma) and `t.relatedCount` (drizzle) accept only list relations. Code that
  called either on a to-one relation (which built a count query prisma or drizzle rejected at
  runtime) compiled before and now fails to compile.
- `t.relatedField` (drizzle) accepts the ordinary field options (`deprecationReason`,
  `extensions`, `authScopes`, ...); its `resolve` may be async and receives the resolve `info`.
  Exported as `RelatedSelectionFieldOptions`.
- New `PrismaQueriedShape<Types, Model, Query>` and `DrizzleQueriedShape<Types, Table, Query>`
  name the row shape a query loads, for resolvers that load rows themselves.
- The drizzle plugin's unused `withUsageCheck` option on its internal `queryFromInfo`, and the
  commented-out call sites for it, are removed: a drizzle resolver is handed a query builder
  function, so the prisma-style check that observes reads on a query object cannot see the
  realistic mistake (never calling `query()`), and a check that could would be a new mechanism.
- Docs: how selections are planned (a field is either planned into an ancestor's query or loaded
  on its own, never both; selections share a query node only with matching arguments; a
  field-level `select` merges with its siblings), prisma `findUnique: null`, `onNull`, `select`
  on `t.prismaField`, `nestedSelection`'s typed segments and third argument,
  `skipDeferredFragments`, `prismaFieldWithInput`/`drizzleFieldWithInput`, drizzle
  `drizzleInterface`/`drizzleInterfaceField(s)`, `t.variant(Ref, { select })`, connection size
  options, the drizzle fallback loader, and the error for conflicting type-level selections.
