# @pothos/plugin-drizzle

## 0.19.1

### Patch Changes

- b1b147d: Preserve bigint and Date values in compound node IDs, which previously threw or came back as a string

  Parse numeric node IDs with `Number` rather than `parseInt`, so a non-integer ID no longer truncates

## 0.19.0

### Minor Changes

- 0c7565a: Selections can be built by async callbacks. New `AsyncSelections` flag in the schema types, off by
  default.
  - `AsyncSelections: true` widens what the selection callbacks accept: a field's `select` function,
    a relation `query` callback, a `relationCount` / `relatedCount` `where` callback, and the
    `select` / `query` callbacks of `prismaConnectionHelpers` and `drizzleConnectionHelpers` may all
    return promises. Without the flag they are typed as synchronous and an async callback is a type
    error, which is what the prisma plugin needed: it accepted an async `select` and silently
    dropped the selection it resolved to.
  - The plugins still build one query. Callbacks start in the same tick, and what they return is
    merged after every synchronous selection, in document order. Async argument mappers (such as the
    validation plugin's) are awaited before the field's `select` runs. Synchronous selection planning
    remains synchronous and does not create promises solely to support async callbacks.
  - Inside an async `select`, `await` the result of `nestedSelection` before adding it to the
    selection. A `select` that returns while a nested selection it started is still pending throws,
    naming the field.
  - Everything the plugins generate settles its plan before your resolver runs, so a schema built
    only from `t.relation`, `t.relationCount` / `t.relatedCount`, `t.prismaField` /
    `t.drizzleField`, `t.prismaConnection` / `t.drizzleConnection` and `t.relatedConnection` can
    turn the flag on and change nothing else. The `query()` builder handed to a `drizzleField` or
    `drizzleConnection` resolver never returns a promise for the same reason.
  - The places where your own code asks for a query or a selection are the ones to audit:
    `queryFromInfo` (prisma), a connection helper's `getQuery` (both plugins), `nestedSelection`,
    and `mergeNestedSelection`. `queryFromInfo` and `getQuery` build the query synchronously and
    take an `awaitSelections` option; pass `awaitSelections: true` to get a `MaybePromise` and
    `await` it. A call that did not ask for a promise throws, naming the option and what the call
    was building — `queryFromInfo` the field, `getQuery` the connection's model or table, which is
    as much as it is given — rather than returning one where the declared type said there was none:
    a promise spread into a prisma or drizzle call is one unusable key and no type error. Two things
    make the query async. One is a selection beneath the field, which is a property of the document
    rather than of the call site. The other is the helper's own `select` or `query` callback: an
    async one makes `getQuery` throw for a fully synchronous document, since it is the helper's own
    callback that has not settled. The return type follows the option's literal type, so the default
    keeps the plain query; a non-literal `boolean` gets the `MaybePromise`, since the call cannot
    rely on the synchronous type either.
  - A selection passed to drizzle's `query()` comes first, as it does for `queryFromInfo`: a
    relation the document also plans with other arguments loads on its own.

- 1358f71: Cursors and node ids round trip for the column types a key holds — numbers, strings, bigints,
  dates, booleans, decimals and byte arrays — and compound cursors are encoded with per-part type tags so
  every value in one keeps its type, including booleans in Prisma compound unique keys.

  A compound cursor was a plain JSON array of the raw values in the prisma plugin. That throws
  outright on a bigint, so a connection whose cursor is a `@@id` or `@@unique` containing a `BigInt`
  column failed on every edge of every page; it wrote a `DateTime` out as an ISO string that came
  back as a string, so the millisecond a row was created on was gone by the time the value reached
  the query; and it wrote a `Bytes` column out as the JSON form of a buffer. Every part now carries
  its own type tag. The drizzle plugin already tagged each part; what changes there is that a
  compound cursor can hold bytes, a decimal and a JSON value there too.

  A null cursor value now round trips in both plugins. The prisma plugin threw "Unsupported cursor
  type object" while building the edge of a single value cursor, so a connection whose cursor names a
  nullable column failed the whole page rather than only a request that paged from that row; `Json`
  and `Bytes` values could not be written there either. The drizzle plugin wrote the string `null`,
  which is not a value the cursor format can hold, so the cursor came back as "Invalid cursor" the
  moment a client paged from that edge. Both now write a null as a tagged chunk and read it back as
  `null`.

  Cursors issued before this release still parse, in both plugins, to the same values they always
  did. That legacy handling is deprecated and is removed in the next major. The `GPC:` and `DC:`
  prefixes are unchanged, so only compound cursors are written differently; a single value cursor is
  byte for byte what it was, apart from the null that neither plugin could write usefully. A single
  value string cursor also no longer loses everything after the first newline it contains.

  Other values that did not survive a round trip:
  - A cursor value on a float, real or `Decimal` column, in both plugins. It was read back with
    `parseInt`, which truncates `1.75` to `1` and reads a large number's `1e+21` as `1`, so the page
    resumed from the wrong row.
  - A prisma node id built from a `DateTime` field. It was serialized with `String(date)`, whose
    format carries no milliseconds, so `findUnique` looked for a row a fraction of a second before
    the real one and the node resolved as not found. Ids already handed out in the old format still
    parse. A drizzle node id built from a date column had the mirror problem on the way back: `new
Date` was given the epoch milliseconds the serializer writes as a string, which is not a format
    it parses, so every such id resolved as an Invalid Date.
  - A prisma node id built from a `Bytes` field. The base64 case was spelled `Byte`, which is not
    what the datamodel calls the type, so the value was serialized as `String(bytes)` (the bytes
    separated by commas) and parsed back as that string.
  - A drizzle node id built by `builder.drizzleNode` with an `id.column` that is not the table's
    primary key. The id was parsed back into a record keyed by the database column name, while the
    serializer wrote, and the model loader reads, the typescript name; the loaded rows were then
    matched back to the ids they were loaded for by primary key, which such a record does not carry.
    Such a node now loads.
  - A prisma compound node id (a `@@id` or `@@unique` used as `id.field`). It passed the field's
    `kind` (always `scalar`) where the type was wanted, so a `Json` or `Bytes` part was written as
    `String(value)` and could not be read back. Each part is now serialized by its scalar type, as
    the parser already read them.

  Two paging fixes that go with them:
  - A connection asked for `last: 0` pages backwards in both plugins, as any other `last` does. `0`
    was read as "no `last` given", so the query took rows forwards and `pageInfo` came back as
    though the request had been a forward page: `hasNextPage` true and `hasPreviousPage` false on a
    non-empty connection.
  - A prisma compound cursor carrying the wrong number of values is rejected with a validation error
    naming both counts, rather than building a query with a missing key (or silently dropping an
    extra one) for prisma to reject. The drizzle plugin already checked this.

  The tagging itself lives in `@pothos/core` (`encodeCursorChunk`, `encodeCursorTuple` and
  `decodeCursorChunk`, alongside `encodeBase64Bytes` / `decodeBase64Bytes`) rather than being written
  out once per plugin.

- 1358f71: `t.relatedCount` and a `t.relatedConnection`'s `totalCount` now count the rows the connection pages
  over. The parent-to-child SQL is built by drizzle's `relationToSQL` instead of being reassembled
  from the relation's source and target columns, so the plugin and the relational query builder agree
  on what "related" means.
  - New builder option `drizzle.filterConnectionTotalCount` (default `true`): `totalCount` on a
    `t.relatedConnection` applies the `where` returned by the field's `query`, so it counts the same
    rows the connection paginates. Previously it reported the unfiltered count. Set the option to
    `false` to keep counting every related row regardless of the filter, matching the prisma plugin's
    option.
  - A count over a many-to-many relation (one defined with `.through(...)`) counts related rows. The
    junction table was left out, which compared the parent's key to the target's key instead: the
    count came back as the number of target rows that happen to share an id with the parent, with no
    error. The same correction applies to the filter `t.relatedField` hands to its `select` callback.
  - A count honours a `where` declared on the relation itself, and the `where` a relation without
    `from`/`to` inherits from the relation it reverses. Both were dropped, so the count included rows
    the connection does not page over.
  - The count reads the relation's source column off the parent by its typescript name, as every
    other read of a row does. A table declaring `postId: integer('id')` carries it as `postId`, so
    the count bound `undefined` and the driver rejected the query with "undefined cannot be passed as
    argument to the database".
  - `totalCount` and the query that pages the relation are now the same predicate: the count selects
    from what the page query selects from and repeats its `where` clause, minus the limit, the
    ordering and the keyset clauses.
  - A count over a many-to-many relation joins the junction table by its index. `t.relatedCount`
    counts a related row once however many junction rows reach it; a `t.relatedConnection`'s
    `totalCount` counts rows the way the page query returns them, so the two report different
    totals for a relation whose junction holds duplicate rows.
  - A `drizzleConnection` declared `nullable: false` no longer queries rows for a document that
    selects only `totalCount`. The check that recognises a count-only selection read the field's
    return type without unwrapping it, so a non-null connection never matched and always loaded a
    page of rows it then discarded. Nullable connections were already unaffected.

- 1358f71: When a field's data is missing from the parent row it falls back to the model loader, which
  reloads the row. That fallback now loads the right row, and loads more of it.
  - The loaded row also carries the parent type's type-level `select`/`include` (prisma) or
    type-level columns, relations and extras (drizzle), since that row replaces the parent the
    resolver sees. Fallback queries therefore load more than before: the parent type's own columns
    and its type-level relations. The field's own selection always wins — a type-level relation
    whose arguments conflict with it is left out of that query — and when a prisma type-level
    `_count` has several counts and one conflicts with the count a field selects for itself, the
    loader keeps the other counts instead of dropping `_count` altogether.
  - Drizzle: `t.relation`, `t.relatedCount` and `t.relatedConnection` fall back to the loader when
    their data is missing from the parent row — most often because the row was returned by a
    resolver that fetched it itself. Previously the loader was reached only when the field had no
    loader mapping at all, and a row without the relation on it resolved as `undefined` or as an
    empty page. `t.relatedConnection` decides what it has by reading its selection at resolve time
    the same way the planner does, through fragments, `@skip`/`@include`, and a wrapping type, so a
    row that carries the relation rows but not the count reloads rather than reporting `totalCount`
    as `undefined`.
  - Prisma: a model load that failed before its query was sent hung the request instead of returning
    an error. The loader batches the rows it reloads and sends one query per row on the next tick. A
    throw while building any of those queries, most reachably `findUnique: null`, which throws
    `Missing findUnique for <type>`, abandoned every row it had not reached yet, so those fields
    never resolved and never errored and the request never finished. Every row in the batch now
    rejects with that error, matching what `@pothos/plugin-drizzle` already did.
  - Prisma: the per-row fallback plan is cached. When a relation or related connection has a
    user-supplied `resolve` and the planned query did not load it, the field's resolver plans the
    field for itself; that planning ran again for every row of the list its parent came from. It is
    now cached per `Type@path` per request, the way `ModelLoader` already caches its own entry point
    and under the same key: the plan is settled once and played per call, so each row still gets a
    query of its own and still records the same mappings under the same keys. On a document with 161
    such resolutions the planning cost falls from about 405µs to about 68µs per request, with the
    queries issued and the response unchanged.

- 220a1b1: The selection API is now typed to match what it actually does.

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
  - The `query` a `t.relation` fallback `resolve` receives (prisma) — the relation's own arguments
    (`where`, `orderBy`, `take`, ...) alongside the planned `select`/`include` — has a name:
    `QueryFromRelation`.
  - `t.relatedField` (drizzle) accepts the ordinary field options (`deprecationReason`,
    `extensions`, `authScopes`, ...), and forwards every one of them to the field it builds, merging
    `extensions` rather than dropping them; `t.relatedCount`, which is built on it, gets the same.
    Its `resolve` may be async and receives the resolve `info`. Exported as
    `RelatedSelectionFieldOptions`.
  - A query whose `select` key is optional but names columns (`{ select?: { email: true } }`)
    narrows the row to those columns, rather than to no columns at all as `ShapeFromSelection` did
    before: the columns are on the row whether or not the `select` is applied, since a row loaded
    without a `select` carries every column.

  The docs for both plugins now cover how a field gets its data, and when it costs a query of its
  own. Also newly documented: prisma `findUnique: null`, `onNull`, `nestedSelection`'s typed
  segments and third argument, `skipDeferredFragments`,
  `prismaFieldWithInput`/`drizzleFieldWithInput`, drizzle
  `drizzleInterface`/`drizzleInterfaceField(s)`, `t.variant(Ref, { select })`, connection size
  options, the drizzle fallback loader, and the error two variants raise when their selections
  conflict.

- 220a1b1: The prisma and drizzle plugins now plan their queries with one shared selection planner, the new
  package `@pothos/selection-mapper`. Each plugin keeps its own adapter for its query format; the
  walk from a GraphQL selection to a query is the same code in both.

  The plugins' public API is unchanged: only internal helpers moved (each plugin's `map-query`,
  `selections`, `loader-map` and `deep-equal`), and the loader mapping keys (internal) now carry the
  full field path. Behaviour that differed between the two plugins for no reason now agrees. In
  particular, prisma walks fragments the way drizzle did: fields under a fragment on an interface the
  type implements, including interfaces not backed by a model, are planned for the type instead of
  falling back to a query per row.

  The package is an implementation detail of the two plugins. Its exports exist for them and change
  with them: it is not a supported public API, and its versions carry no compatibility promise of
  their own.

- 1358f71: Entering another type of the same model through a fragment (a variant under a model interface or
  union) now merges that type's type-level selection, so resolvers relying on it find their data in
  the same query. This can change the shape of queries a schema with variants issues, and it adds one
  validation error.
  - A variant without a type-level `select` switches the query to include mode (prisma) or every
    column (drizzle).
  - If the two types' type-level selections disagree on a relation's arguments, a validation error
    names both types and the relation; move the relation arguments to a field-level `select` on one
    of the types. The error is raised whichever route brought the two types together: a fragment
    entering a variant, or two indirect-include path matches landing on different types of the one
    model. Relation arguments are compared structurally, so equal arguments written
    separately are fine. In drizzle, two types defining the same `extras` key with different
    functions are rejected the same way, naming the extra: an extra shared across variants must be
    the same function reference.
  - The type-level selections of every variant entered at a selection set are merged before the
    fields there are planned, so the result no longer depends on document order: a field-level
    `select` whose relation arguments conflict with a variant's type-level selection falls back to
    its own query whichever comes first, and only two type-level selections can conflict.
  - A walk on an object type is a walk on rows of that type: the field's own type, the `typeName`
    given to `queryFromInfo`, the type pinned by `nestedSelection`, or a node load. A fragment on
    another object type of the same model cannot apply to those rows, so it is not entered; it is
    entered while walking an interface, where rows may resolve to it. Prisma previously entered it
    whenever the field's declared type was abstract, planning a sibling variant's selection for
    rows that could never be it.
  - A fragment that does not apply to the type still lets a nested fragment narrow back to it.
    Drizzle previously stopped at the outer fragment and discarded what was nested inside it.

### Patch Changes

- 220a1b1: Drizzle plugin fixes.
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
  - Requires Drizzle `1.0.0-rc.2` or newer for the relation SQL API used by counts and predicates.
  - Custom connection fields retain their rows when `totalCount` is selected.
  - Connection helper `resolve()` returns a maybe-promise for async-enabled schemas; await it
    before inspecting or spreading connection fields.
  - Nested query callbacks passed to `nestedSelection` now receive `PathInfo` as their third
    argument, after the field arguments and context.

- 1358f71: Fix how selections are found through fragments, paths and wrapper types, in both plugins. Each of
  these left a field to load its own data per row, or planned the wrong selection for it.
  - A path segment selected behind a fragment that narrows an interface or union
    (`... on Impl { field }`), or a fragment on an interface that overlaps the list type, is now
    found without needing to pin the type on the segment. Previously the field was skipped and the
    plugin fell back to a separate query per row. Drizzle crashed on a fragment spread that narrows
    an interface.
  - When the same field is selected in several places (multiple fragments, several `paths`, or the
    same response key under several fragments), every selection is merged into one query. Previously
    `queryFromInfo` kept only the last one, and a field loaded through the fallback planned only its
    first occurrence.
  - A relation selected under both `nodes` and `edges { node }` of a connection is answered from the
    loaded rows in both places. The loader mappings used to be keyed by field alias alone, so the
    second path fell back to a query of its own.
  - A `nestedSelection` path into a field selected through a fragment on the same type
    (`... on Type { field }` or `...Fragment`) now merges the nested selection instead of producing
    an empty selection.
  - Fragment spreads and inline fragments left out by `@skip` / `@include` are no longer planned, so
    they neither enter a variant nor add fields to the query.
  - `queryFromInfo`'s `path` and `paths` accept `{ name, type }` segments alongside strings, in the
    types and the docs as well as at runtime. A segment `type` pins the fragment type condition the
    field must be found under, which is useful when several implementations share a field name. The
    pin is applied wherever the field is looked for, not only where a fragment was crossed to reach
    it: a field of the same name selected directly on a level that is not the pinned type is no
    longer taken as the segment's, so the match no longer carries that level's return type instead
    of the pinned type's. A segment `type` that does not exist in the schema is a validation error,
    rather than a `TypeError` (prisma) or a path that silently matches nothing (drizzle).
  - When several implementations share a field name, matches whose field returns a different model or
    table than the one the query is being built for are ignored, so their selections are never merged
    into the wrong query. Variants of the target model are walked with their own fields.
  - A type carrying `pothosIndirectInclude` with `paths` only contributes its own selection when it
    is backed by the model being queried. A plain wrapper, or a wrapper backed by another model, no
    longer merges its selection into the target model's query.
  - `queryFromInfo` with `path`/`paths` that select nothing now returns the `select`/`include`
    (prisma) or `select` (drizzle) it was given, or `{}`, instead of an empty `select` (which prisma
    rejects) or a query that dropped the caller's selection.
  - The selection lookup handed to a field's `select` callback (the fourth argument) now looks
    through wrappers on the field's return type and returns the first match. A `relatedConnection`
    with `totalCount: true` wrapped by `@pothos/plugin-errors` now selects the count, and its
    totalCount-only handling agrees with what was planned.
  - A field `select` callback returning `false`, `null` or `undefined` is treated as selecting
    nothing: the field is not answered from the parent row and loads its own data when resolved.
    `false` used to switch the query to include mode and still record the field as loaded, so it
    resolved from a row that held nothing for it; `null` and `undefined` threw.
  - Relation arguments compare the same way whichever of two selections was planned first. The
    structural equality both plugins use decided whether a value was an array, or a boxed value such
    as a `Date`, by looking only at its left-hand argument: `{}` and `[]` compared equal one way
    round and unequal the other, and so did `{}` and a `Date`. That helper answers whether two
    selections of one relation ask for the same arguments, so an answer that depended on argument
    order could let an incompatible selection merge and replace the arguments already planned, or
    refuse a compatible one and issue a separate query for the field. Both guards now read both
    sides. `orderBy` is the argument where this is easiest to hit, since prisma accepts an object and
    an array there for the same meaning.
  - @pothos/selection-mapper@0.1.0

## 0.18.1

### Patch Changes

- 6424480: Plan fragments on interfaces implemented by a Drizzle object against the object, so `select` declared on the interface's fields is merged into the query instead of being skipped and loaded separately. Export `DrizzleInterfaceRef` and the `DrizzleRef` type from the package index.

## 0.18.0

### Minor Changes

- 4105614: Tag each value in a compound cursor, so cursors covering more than one column round trip `Date` and `bigint` values.

  Compound cursors were serialized with plain JSON, which returns a `Date` as a string and cannot serialize a `bigint` at all. Single-value cursors did not have this problem, so it only surfaced on orderings that named more than one column. Cursors written before this change are still read.

  Also fixes two crashes reachable from the same orderings: an ordering value of `null` now compares with `IS NULL` rather than throwing out of drizzle, and composite primary keys are looked up against the table's own columns, which the postgres dialect does not use when reporting them.

  Composite primary keys are now used as the tie breaker whether or not their columns are marked `notNull()`, since SQL makes primary key columns non-nullable regardless. Previously a key declared with `primaryKey({ columns: [...] })` alone was skipped, leaving those connections with the non-unique ordering the tie breaker exists to fix.

- 99cf79e: Connection `orderBy` can now name an extra selected by the same query, rather than only a column:

  ```ts
  query({
    extras: { titleLength: (table) => sql`length(${table.title})` },
    orderBy: { titleLength: "asc" },
  });
  ```

  Pothos orders by the expression, builds the cursor from the value it returns, and compares the expression when paging.

  This gives cursors a way to carry a value the column's JavaScript mapping does not preserve. A `timestamp({ mode: 'date' })` column is returned as a `Date`, which only holds milliseconds, so a cursor built from it cannot address a row stored with microsecond precision. Selecting the full value as an extra and ordering by that can. See "Ordering and cursors" in the drizzle plugin docs.

### Patch Changes

- d5211ea: Add the primary key to connection `orderBy` when the ordering is not already unique.

  A cursor records a row's position in an ordering. When that ordering is not unique, `orderBy: { createdAt: 'desc' }` for example, rows sharing a value can be returned in a different order on each query, so paging through the connection may return a row twice, or skip it.

  Connections ordered by a unique set of non-nullable columns are unchanged. Other connections get the primary key as a trailing order column, and their cursors include the matching values. Cursors created before this change still work: they page from the columns they contain, and the cursors returned by that page contain the full set.

## 0.17.6

### Patch Changes

- 265c4c8: Treat `undefined` query properties as absent when building Drizzle queries. Query callbacks that return a conditional filter (e.g. `where: cond ? filter : undefined`) previously produced a selection that compared as incompatible with an equivalent selection that omitted the key, causing the field's selection to be dropped. `where`, `orderBy`, `limit`, and `offset` are now normalized before selections are stored, compared, or passed to Drizzle.

## 0.17.5

### Patch Changes

- 76e06e7: Rebuild with TypeScript 7. Source files now use explicit `.js` import extensions (enforced by
  lint) instead of adding them during the build, and declaration files are emitted by TypeScript
  7's compiler. Published output is functionally unchanged.

## 0.17.4

### Patch Changes

- 67bfeb7: Support drizzle-orm@1.0.0-rc.2. The `_` shape on Drizzle clients dropped the
  `schema`, `fullSchema`, and `tableNamesMap` properties; the plugin's
  `DrizzleClient` type has been narrowed to only require `relations`, which is the
  only field it actually reads.

## 0.17.3

### Patch Changes

- 04650f5: Fix autocomplete dropping after first property in `query()` callback of `drizzleField` resolver

## 0.17.2

### Patch Changes

- 1e65828: Fix broken types in `query` argument of `drizzleField`, `drizzleConnection`,
  `t.relation`, and related connections after the drizzle-orm 1.0.0-beta.10
  update. The plugin was still referring to the removed `$relationBrand` and
  `targetTable['_']['name']` properties on `Relation`, which caused the query
  filter/option types to collapse to `any`.

## 0.17.1

### Patch Changes

- e8c02e5: Fix column selection merging to respect `false` values. Columns explicitly set to `false` in a selection are no longer added to the query.

## 0.17.0

### Minor Changes

- 0c2f318: Add pathInfo parameter to t.relation() and t.relatedConnection() query callbacks for path-based filtering.

  PathInfo includes:
  - `path`: Array of "ParentType.fieldName" strings (e.g., `['Query.user', 'User.posts']`)
  - `segments`: Detailed info for each path segment including field, alias, parentType, and isList

  Example usage:

  ```typescript
  posts: t.relation("posts", {
    query: (args, ctx, pathInfo) => {
      // Check if accessed via viewer (own profile) vs user (public)
      const isViewerContext = pathInfo?.path?.at(-2) === "Query.viewer";
      return {
        where: { published: isViewerContext ? false : true },
      };
    },
  });
  ```

## 0.16.2

### Patch Changes

- ab0af70: Update to support drizzle-orm 1.0.0-beta.10

## 0.16.1

### Patch Changes

- 9993d01: Fix a bug where selecting only connection count at the same time as another field selected the same relation would cause an error"

## 0.16.0

### Minor Changes

- 3509aab: Add new field builder methods and connection enhancements:
  - `t.relatedField`: New method for creating custom fields based on relations with custom selections using the `buildFilter` callback
  - `t.relatedCount`: Simplified method for counting related records, with optional `where` filter support
  - `totalCount: true` option for `relatedConnection`: Adds a `totalCount` field to related connections
  - `totalCount` callback for `drizzleConnection`: Allows adding a `totalCount` field to drizzle connections
  - `totalCountOnly` optimization: Skips the main query when only `totalCount` is requested (for both connection types)

## 0.15.0

### Minor Changes

- 27d5aae: Fix mappings when merging selections across fragments

## 0.14.0

### Minor Changes

- 2a582ac: Update for drizzle@1.0.0-beta.2

## 0.13.0

### Minor Changes

- ede7c1d: Improve typing of query argument for drizzleField and drizzleConnection

### Patch Changes

- 3403c66: update dependencies

## 0.12.1

### Patch Changes

- e229f0e: Fix bug that incorrectly resolved table names when typescript and db names did not match

## 0.12.0

### Minor Changes

- 64e6e55: Update types to work with latest beta release

## 0.11.2

### Patch Changes

- 99ffc20: Fix column selection logic when merging selections
  - When `select` on Types and Fields does not contain `columns` no additional columns are selected
  - All nested selections (in `with`) match drizzle query API, where no explicit `columns` means all columns are selected
  - Inferred types now correctly match the selection logic above

## 0.11.1

### Patch Changes

- 517b559: Improve types when replace resolve definitions

## 0.11.0

### Minor Changes

- 12713e5: improve handling of iterable connections

### Patch Changes

- 12713e5: Fix parent type for builder.drizzleObjectField(s)

## 0.10.6

### Patch Changes

- 111ac8c: Fix relay options for drizzleNodes

## 0.10.5

### Patch Changes

- 1622740: update dependencies

## 0.10.4

### Patch Changes

- d5e9505: Fix resolution for alias primaryKey columns

## 0.10.3

### Patch Changes

- 0046a00: Correctly pass parent in connection results

## 0.10.2

### Patch Changes

- 0a1973e: fix drizzleInterfaceFields and interface variants

## 0.10.1

### Patch Changes

- 192c9c4: fix typing for ref on relatedFields and node variants

## 0.10.0

### Minor Changes

- 73a4c4e: Allow implementing entry connections with drizzleConnectionHelper

### Patch Changes

- 31e8c53: Fix default selection for drizzleObjects and nodes

## 0.9.0

### Minor Changes

- f350ef2: Update all APIs to use RQBV2

  ## RQBV2 Changes

  Please refer to https://rqbv2.drizzle-orm-fe.pages.dev/docs/relations-v1-v2 and https://rqbv2.drizzle-orm-fe.pages.dev/docs/relations-v2 for detailed instructions on setting up drizzle to use the RQBV2 API.

  This currently requires installing `drizzle-orm@beta`

  ## Pothos breaking changes

  ### Setup

  Setting up the plugin now requires the drizzle `relations` instead of the `schema`, as well as the `getTableConfig` function for your sql dialect:

  ```
  import { drizzle } from 'drizzle-orm/...';
  // Import the appropriate getTableConfig for your dialect
  import { getTableConfig } from 'drizzle-orm/sqlite-core';
  import SchemaBuilder from '@pothos/core';
  import DrizzlePlugin from '@pothos/plugin-drizzle';
  import { relations } from './db/relations';

  const db = drizzle(client, { relations });

  type DrizzleRelations = typeof relations

  export interface PothosTypes {
    DrizzleRelations: DrizzleRelations;
  }

  const builder = new SchemaBuilder<PothosTypes>({
    plugins: [DrizzlePlugin],
    drizzle: {
      client: db, // or (ctx) => db if you want to create a request specific client
      getTableConfig,
      relations,
    },
  });
  ```

  ### Where and OrderBy

  The `where` and `orderBy` options have changed to match the RQBv2 API:

  ```diff
      builder.drizzleObject('users', {
      name: 'User',
      fields: (t) => ({
          posts: t.relation('posts', {
          query: (args) => ({
  -            where: (post, { eq }) => eq(post.published, true),
  +            where: {
  +                published: true,
  +            },
  -            orderBy: (post, { desc }) => desc(post.updatedAt),
  +            orderBy: {
  +                updatedAt: 'desc',
  +            },
          }),
          }),
      }),
      });
  ```

  ### extras

  `extras` no-longer require a `.as(name)` call, but must use a callback style to reference table columns:

  ```diff
  const UserRef = builder.drizzleObject('users', {
    name: 'User',
    select: {
      extras: {
  -      lowercaseName: sql<string>`lower(${users.firstName}).as('lowercaseName')`
  +      lowercaseName: (users, sql) => sql<string>`lower(${users.firstName})`
      },
    },
  });
  ```

  ### Other stuff

  This release contains many other bug fixes, dozens of new tests, and a new `drizzleConnectionHelpers` API.

### Patch Changes

- cd7f309: Update dependencies

## 0.8.1

### Patch Changes

- 0f2a64e: fix issue with staged queries not being reset correctly after executing

## 0.8.0

### Minor Changes

- 2c0e072: Skip querying field selections within `@defer`red fragments

## 0.7.2

### Patch Changes

- d874bce: Improve inference of multiple interfaces

## 0.7.1

### Patch Changes

- c1db173: Fix error plugin compatability

## 0.7.0

### Minor Changes

- 9cfb6a7: cache input mappings accross resolvers to reduce memory ussage in large schemas

## 0.6.0

### Minor Changes

- 4315edc: Export Object ref type in drizzle plugin

## 0.5.3

### Patch Changes

- 67295e5: Fix drizzle cursors skipping first node after a cursor

## 0.5.2

### Patch Changes

- c71b6bd: fix: drizzle plugin model loader when multiple models are requested

## 0.5.1

### Patch Changes

- 52a70e9: Load client when db request is initialized rather than caching on model loader

## 0.5.0

### Minor Changes

- aadc82c: export client cache so it can be reset during request

## 0.4.7

### Patch Changes

- e98383b: use getMappedArgumentValues to improve relay compatibility

## 0.4.6

### Patch Changes

- 0aadded: improve handling of null cursor values

## 0.4.5

### Patch Changes

- bc73a7b: Fix table types for queries on relations to aliased tables

## 0.4.4

### Patch Changes

- 6dbe790: fix drizzleField list types

## 0.4.3

### Patch Changes

- fa2429f: Fix drizzleFieldWithInput

## 0.4.2

### Patch Changes

- cc5f993: Fix cursors using aliased coluns

## 0.4.1

### Patch Changes

- a6d105b: fix aliased table relations

## 0.4.0

### Minor Changes

- e6a3fb8: Fix query being required, and improve node IDs

## 0.3.0

### Minor Changes

- fc44ea7: Strip path prefixes in built code

## 0.2.1

### Patch Changes

- 0a94d29: Handle parsing of table config in config utils

## 0.2.0

### Minor Changes

- 566ca22: Add option to initialize drizzle client with context

## 0.1.0

### Minor Changes

- 27af377: replace eslint and prettier with biome

## 0.0.1

### Patch Changes

- dd2e758: Initial preview release
