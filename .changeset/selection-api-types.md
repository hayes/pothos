---
'@pothos/selection-mapper': patch
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

The selection API is typed by what it does, and everything it does is documented.

Two changes can stop existing code from compiling; in both cases that code failed at runtime before:

- `t.relationCount` (prisma) and `t.relatedCount` (drizzle) accept only list relations. Calling
  either on a to-one relation built a count query prisma or drizzle rejected.
- `queryFromInfo` (prisma) is typed by what it was given: `{ include }` when one was passed,
  `{ select?, include? }` when neither was, and for a given `select` the union of `{ select }` and
  `{ include? }`, since a type in include mode merges the select into an `include` query. It used
  to claim `{ select: Select }` for every call without `include`, so code reading `.select` off
  that result now sees it as possibly undefined. Every form spreads into a prisma call as before.

New and widened types:

- `nestedSelection` returns the relation query for the field's model or table (prisma:
  `PrismaRelationQuery<Model>`; drizzle: the table's `DBQueryConfig`, a `many` config for a list
  field), keeping the keys it was given as given, so a `select`/`columns` in them still narrows
  the parent shape. Its argument is typed by that query when the field's type names a model, so
  literals such as `select: { title: true }` are kept, and it accepts a callback or a promise as
  the runtime always did. It used to return its argument's type.
- One `PathSegment` type (`string | { name: string; type?: string }`) for `queryFromInfo` paths
  and `nestedSelection` paths, exported from `@pothos/selection-mapper` and re-exported by both
  plugins, together with `IndirectPathSegment` (its `{ name, type? }` form) and `IndirectInclude`,
  whose `path`/`paths` still take only `IndirectPathSegment` objects. A `{ name, type }` segment
  given to `nestedSelection` now pins the implementation the field is found under at runtime, as
  it already did for `queryFromInfo`.
- The `query` a `t.relation` fallback `resolve` receives (prisma) carries the relation's own
  arguments (`where`, `orderBy`, `take`, ...) alongside the planned `select`/`include`, so it
  spreads into a prisma call without a cast. Exported as `QueryFromRelation`.
- `t.relatedField` (drizzle) accepts the ordinary field options (`deprecationReason`,
  `extensions`, `authScopes`, ...); its `resolve` may be async and receives the resolve `info`.
  Exported as `RelatedSelectionFieldOptions`.
- New `PrismaQueriedShape<Types, Model, Query>` and `DrizzleQueriedShape<Types, Table, Query>`
  name the row shape a query loads, for resolvers that load rows themselves.

Docs: how selections are planned (a field is either planned into an ancestor's query or loaded
on its own, never both; selections share a query node only with matching arguments; a
field-level `select` merges with its siblings), prisma `findUnique: null`, `onNull`, `select`
on `t.prismaField`, `nestedSelection`'s typed segments and third argument,
`skipDeferredFragments`, `prismaFieldWithInput`/`drizzleFieldWithInput`, drizzle
`drizzleInterface`/`drizzleInterfaceField(s)`, `t.variant(Ref, { select })`, connection size
options, the drizzle fallback loader, and the error for conflicting type-level selections.
