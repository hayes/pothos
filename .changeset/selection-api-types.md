---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

The selection API is now typed to match what it actually does, and the behaviour it describes is
documented.

Two changes can stop existing code from compiling. In the first case that code already failed at
runtime:

- `t.relationCount` (prisma) and `t.relatedCount` (drizzle) accept only list relations. Calling
  either on a to-one relation built a count query prisma or drizzle rejected.
- `LoaderMappings` (prisma) is a deprecated alias of the shared `Mappings` type. The record it
  names is internal to the plugin, and the plugin no longer builds the `{ field, type, mappings,
  indirectPath }` entries the old declaration described, so code that reads those keys off it no
  longer compiles. Nothing in the plugin's API hands one to a schema.

New and widened types:

- `queryFromInfo` (prisma) is typed by what was passed: `{ include }` for a given `include`, and
  `{ select }` keeping a given select's own type, so the selection round trips. Spread the result
  into a prisma call and read the selected columns and relations back off the rows, with types. A
  call with neither now returns `{ select?, include? }`, whichever of the two the type's mode
  produced, rather than a `select` key that a type in include mode does not return.
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
  name the row shape a query loads, for resolvers that load rows themselves. A query whose
  `select` key is optional but names columns (`{ select?: { email: true } }`) narrows the row to
  those columns, rather than to no columns at all as `ShapeFromSelection` did before: the columns
  are on the row whether or not the `select` is applied, since a row loaded without a `select`
  carries every column.

The docs for both plugins now cover how a field gets its data, and when it costs a query of its
own. Also newly documented: prisma `findUnique: null`, `onNull`, `select` on `t.prismaField`,
`nestedSelection`'s typed segments and third argument, `skipDeferredFragments`,
`prismaFieldWithInput`/`drizzleFieldWithInput`, drizzle
`drizzleInterface`/`drizzleInterfaceField(s)`, `t.variant(Ref, { select })`, connection size
options, the drizzle fallback loader, and the error two variants raise when their selections
conflict.
