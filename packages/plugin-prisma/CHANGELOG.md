# Change Log

## 4.16.0

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

- 220a1b1: Prisma plugin fixes.
  - A relation `query` returning keys set to `undefined` (`{ where: cond ? filter : undefined }`) is
    now treated as compatible with a sibling selection of the same relation. Previously the sibling
    fell back to a separate query per row whenever the condition was false.
  - `onNull` now receives `args`, `context`, and `info`. Previously it was called with empty objects,
    so any callback reading them threw at runtime.
  - A `relatedConnection` selected through more than one fragment (two success fragments of an
    errors-plugin result, one selecting `totalCount` and one `edges`) now plans both the count and
    the rows; it is planned as totalCount-only only when none of `edges`, `nodes` or `pageInfo` is
    selected anywhere, matching the resolver.
  - A connection whose document selects neither `nodes` nor `edges { node }` (only `pageInfo`, say)
    now loads only the cursor columns of the related rows instead of every column. The response is
    the same; the query stops reading columns nothing can ask for.
  - `_count: true` in a type-level or field-level `select` is kept and passed to prisma as
    `_count: true`; it is spelled out per list relation only when a filtered named count has to be
    selected alongside it.
  - Registering the same prisma model as both an object and an interface silently returned the first
    ref for both. `builder.prismaInterface('User', ...)` after `builder.prismaObject('User', ...)`
    (in either order) handed back the ref that was created first, typed as the kind that was asked
    for. It now throws, naming the model and pointing at `variant`, the way `@pothos/plugin-drizzle`
    does for tables. `builder.prismaInterfaceField(s)` given a model name also names that model's
    interface now, rather than its object.

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

## 4.15.0

### Minor Changes

- a32b270: Support TypeScript 7.

  The prisma generator (`prisma-pothos-types`) previously built its output with the TypeScript
  compiler API (`ts.factory` + printer), which no longer exists in TypeScript 7 — the Go-based
  compiler ships no in-process JS API. The generator now emits the same output (byte-identical)
  via string templates, so it no longer imports `typescript` at runtime and works regardless of
  which TypeScript version (or none) is installed. The `typescript` peer dependency of
  `@pothos/plugin-prisma` has been removed accordingly.

  `@pothos/plugin-relay` contains two internal fixes for type-checker differences between
  TypeScript 6 and 7 (explicit type arguments where 7 picks a different inference candidate, and a
  resolver wrapper that is checked against the declared resolver type). No public types changed;
  the plugin now type-checks cleanly under both majors.

### Patch Changes

- 76e06e7: Rebuild with TypeScript 7. Source files now use explicit `.js` import extensions (enforced by
  lint) instead of adding them during the build, and declaration files are emitted by TypeScript
  7's compiler. Published output is functionally unchanged.

## 4.14.3

### Patch Changes

- 43fecad: Fix relatedConnection totalCount returning null when parent is loaded without \_count selections (eg. when query is not spread in parent prismaField resolver)

## 4.14.2

### Patch Changes

- a0b9490: Add relationField to extensions

## 4.14.1

### Patch Changes

- 9993d01: Fix a bug where selecting only connection count at the same time as another field selected the same relation would cause an error"

## 4.14.0

### Minor Changes

- 27d5aae: Fix mappings when merging selections across fragments

### Patch Changes

- ff7d203: Fix generator to handle Prisma views without mutation input types
- 8f23625: Throw better error when prisma datamodel is missing

## 4.13.0

### Minor Changes

- 1e817d8: The `dmmf` option is now required when configuring the Prisma plugin. This is necessary because Prisma 7 no longer exposes DMMF data on the client internals.

  ## Migration

  Import `getDatamodel` from your generated Pothos types and pass it to the prisma config:

  ```typescript
  import PrismaPlugin from "@pothos/plugin-prisma";
  import { PrismaClient } from "./prisma/client";
  import { getDatamodel } from "./prisma/generated";

  const prisma = new PrismaClient();

  const builder = new SchemaBuilder({
    plugins: [PrismaPlugin],
    prisma: {
      client: prisma,
      dmmf: getDatamodel(), // Required in Prisma 7
    },
  });
  ```

## 4.12.0

### Minor Changes

- 77804d1: Enable datamodel generation by default to improve prisma@>6.0 support

## 4.11.0

### Minor Changes

- b87c1dc: Improve typing for custom edge and connection types on related connections

### Patch Changes

- 3403c66: update dependencies

## 4.10.0

### Minor Changes

- 12713e5: improve handling of iterable connections

## 4.9.1

### Patch Changes

- 1622740: update dependencies
- 1622740: revert change that omits the path from prisma generator and updated import path the import from /client.js for new generator

## 4.9.0

### Minor Changes

- 9d6a30c: Import from prisma directory instead of index.ts

## 4.8.2

### Patch Changes

- 3d5c989: Fix esm prisma output location

## 4.8.1

### Patch Changes

- cd7f309: Update dependencies

## 4.8.0

### Minor Changes

- 7d03f42: Allow \_\_typename for queries that only need to select count on connections

## 4.7.0

### Minor Changes

- e149c85: Import types from prismaOutput/index.js instead of directly from prismaOutput to improve esm compatability

## 4.6.0

### Minor Changes

- 955229a: Add support for new prisma-client generator

## 4.5.0

### Minor Changes

- 2c0e072: Skip querying field selections within `@defer`red fragments

## 4.4.1

### Patch Changes

- d874bce: Improve inference of multiple interfaces

## 4.4.0

### Minor Changes

- ea9981f: Support prisma 6.0

## 4.3.1

### Patch Changes

- 52a70e9: Load client when db request is initialized rather than caching on model loader

## 4.3.0

### Minor Changes

- aadc82c: export client cache so it can be reset during request

## 4.2.2

### Patch Changes

- 2f91f2b: Fix ref relay options in plugin-prisma

## 4.2.1

### Patch Changes

- fc44ea7: Fix a few cases where passing PrismaRefs for field types breaks model inference

## 4.2.0

### Minor Changes

- 27af377: replace eslint and prettier with biome

## 4.1.0

### Minor Changes

- 307340a: Improve queryFromInfo typing
- 307340a: Use a shared directive name for defining indirect resolutions

## 4.0.5

### Patch Changes

- 094396d: Fix t.withAuth used with prismaField and PrismaObjectRefs

## 4.0.4

### Patch Changes

- a95bd0a: Add support for composite types when inferring PrismaTypes from client (thanks to @2coo)

## 4.0.3

### Patch Changes

- Updated dependencies [777f6de]
  - @pothos/core@4.0.2

## 4.0.2

### Patch Changes

- 9bd203e: Fix graphql peer dependency version to match documented minumum version
- Updated dependencies [9bd203e]
  - @pothos/core@4.0.1

## 4.0.1

### Patch Changes

- 132a2a5: Fix empty generated.ts file

## 4.0.0

### Major Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- 79139e8: rebuild generator
- c1e6dcb: update readmes
- b2de1f2: fix datamodel generator
- bdcb8cd: Fix prismaFieldWithInput
- Updated dependencies [c1e6dcb]
- Updated dependencies [29841a8]
  - @pothos/core@4.0.0

## 4.0.0-next.4

### Patch Changes

- update readmes
- Updated dependencies
  - @pothos/core@4.0.0-next.1

## 4.0.0-next.3

### Patch Changes

- 924ae0b: rebuild generator

## 4.0.0-next.2

### Patch Changes

- fix datamodel generator

## 4.0.0-next.1

### Patch Changes

- Fix prismaFieldWithInput

## 4.0.0-next.0

### Major Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- Updated dependencies [29841a8]
  - @pothos/core@4.0.0-next.0

## 3.65.3

### Patch Changes

- 1ecea46: revert accidental pinning of graphql peer dependency

## 3.65.2

### Patch Changes

- ae7d3fb: Fix prisma esm import on windows

## 3.65.1

### Patch Changes

- f763170: Add delete method to context caches

## 3.65.0

### Minor Changes

- 3698a15: Accept a typeName for nestedSelection helper to allow optimized sub-selections on
  abstract types

## 3.64.0

### Minor Changes

- 22d4118: Add maxConnectionSize and defaultConnectionSize options
- 22d4118: Fix type issue where using `select` on a type or field for a nullable relation would
  result in the relation being non-nullable on the parent object

## 3.63.1

### Patch Changes

- 9606ed4: [plugin-prisma] Fix prisma generator not creating the ESM build on windows

## 3.63.0

### Minor Changes

- 7672c13: Add support for adding args, and query with where/orderBy to prismaConnectionHelpers

## 3.62.0

### Minor Changes

- b3cb5fd: Arguments support for prisma relation count

## 3.61.0

### Minor Changes

- 0be6da5c: Fix issue with detection for totalCount only selections

## 3.60.0

### Minor Changes

- 018c797c: Prevent loading full relation on a prisma connection when only total count is selected

## 3.59.3

### Patch Changes

- 094359cd: Expose prismaModelKey

## 3.59.2

### Patch Changes

- 0d8d60fa: add another case for @skip and @include when generating prisma selections

## 3.59.1

### Patch Changes

- 1fc5b60b: Support Client Directives in Prisma plugin (@skip and @include)

## 3.59.0

### Minor Changes

- 1bbd3d70: update model loader to cache query mappings and batch compatible queries to reduce
  likelyhood of prisma deoptimization

## 3.58.0

### Minor Changes

- 4ebfa27b: Add prismaInterfaceField(s) method

### Patch Changes

- 4ebfa27b: Fix bug that ignored differences in Date values when checking compatability between
  selections

## 3.57.0

### Minor Changes

- c7756128: Improve typing for t.expose methods when strict mode is disabled

## 3.56.1

### Patch Changes

- 016011f2: Fix custom descriptions in t.expose methods

## 3.56.0

### Minor Changes

- Fix unused query check for prismaConnections

## 3.55.0

### Minor Changes

- 39237239: Add builder.prismaInterface to allow interface variants of a prisma model

## 3.54.0

### Minor Changes

- 7494da05: Add `onUnusedQuery` option to the prisma plugin options

## 3.53.0

### Minor Changes

- 5d3f7b97: Improve inference for t.expose methods on prisma field builder

## 3.52.0

### Minor Changes

- 624f2d05: Add optimizations for nodes field on connections

## 3.51.1

### Patch Changes

- e8139e73: Fixed a bug where totalCount was not selected correctly when selected through a fragment

## 3.51.0

### Minor Changes

- dbdb6f03: Fix compatability with prisma@4.13.*

## 3.50.1

### Patch Changes

- 5b6007cd: Prevent unavailable prisma CreateInput types from being referenced by pothos generated
  types.

## 3.50.0

### Minor Changes

- 27b0638d: Update plugin imports so that no named imports are imported from files with side-effects

## 3.49.1

### Patch Changes

- b39e7eab: Fix bug where queryFromInfo would default to the wrong type when setting path without
  also specifying a typeName

## 3.49.0

### Minor Changes

- 0c042150: Allow globalConnectionFields to be overwritten on specific connections

## 3.48.0

### Minor Changes

- b3259d3e: Make parent and args available in connection and edge fields of prisma connections

## 3.47.3

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.47.2

### Patch Changes

- 14f8cd5c: Fix returning nulls from nullable prismaConnections

## 3.47.1

### Patch Changes

- 80c62446: Fix issue with connection helpers and extendedWhereUnique

## 3.47.0

### Minor Changes

- 5ea5ce24: Allow t.relatedConnection to override take, skip, and cursor in the query option

## 3.46.0

### Minor Changes

- 1878d5d9: Allow readonly arrays in more places

## 3.45.0

### Minor Changes

- e5295551: Add initial support for mutation input in prisma utils
- 72bd678a: Add new prismaUtils feature flag to the generator

## 3.44.0

### Minor Changes

- 07bf6d4f: Simplify how relations are defined in PrismaTypes
- 93bd2842: Support typescript@5.0

## 3.43.0

### Minor Changes

- e8d75349: - allow connection fields (edges / pageInfo) to be promises
  - add completeValue helper to core for unwrapping MaybePromise values
  - set nodes as null if edges is null and the field permits a null return

## 3.42.0

### Minor Changes

- 384bc124: Add nullability option to prismaNode

## 3.41.3

### Patch Changes

- 853f3cfb: Fix hasPreviousPage for connections using only last

## 3.41.2

### Patch Changes

- 687c6e2d: Fix `last` when used without `before`

## 3.41.1

### Patch Changes

- 592ffd3b: Fix name option for prismaNode

## 3.41.0

### Minor Changes

- bf0385ae: Add new PothosError classes

## 3.40.3

### Patch Changes

- 372260ec: Fix bug that prevented prisma from correctly including selections when using the
  directResult option from the errors plugin

## 3.40.2

### Patch Changes

- 98c6e801: Fix issue when using path and typeName together in resolveQueryFromInfo

## 3.40.1

### Patch Changes

- 5c6e0abb: Add placeholder generated file with instructions to run `prisma generate`

## 3.40.0

### Minor Changes

- 75d13217: Export utils for formatting prisma cursors

## 3.39.0

### Minor Changes

- c3db3bcd: Enable adding interfaces to connections and edges

## 3.38.1

### Patch Changes

- 943cb073: import from @prisma/client/index.js for esm generated types

## 3.38.0

### Minor Changes

- 41426ee7: Add export specifier and esm output for generated prisma types

## 3.37.0

### Minor Changes

- 26774fa0: Rewrite prismaConnectionHelpers to properly work with indirect relations

## 3.36.0

### Minor Changes

- 8841e861: Add builder.prismaObjectField(s) method to extend prisma objects and simplify defining
  circular relationships
- cd1c0502: Add support for nested lists
- 99bc6574: Add initial support for reusable prisma connections

## 3.35.8

### Patch Changes

- d4d41796: Update dev dependencies

## 3.35.7

### Patch Changes

- b6be576d: Fix typing for nullable prisma connections

## 3.35.6

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 3.35.5

### Patch Changes

- b12f9122: Fix issue with esm build script

## 3.35.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 3.35.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 3.35.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 3.35.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 3.35.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 3.34.1

### Patch Changes

- aa18acb7: update dev dependencies

## 3.34.0

### Minor Changes

- a76616e0: Add prismaFieldWithInput method

## 3.33.0

### Minor Changes

- cf93c7c9: Fix some edge cases with how option objects become optional when no arguments are
  required

## 3.32.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 3.31.1

### Patch Changes

- 47fea5ed: Fix: add .ts extension to filename for generated prisma fields

## 3.31.0

### Minor Changes

- 50a60d92: Support prisma filtered relations counts

### Patch Changes

- e297e78a: Support typescript@4.8

## 3.30.0

### Minor Changes

- 521cde32: Improve how default output location for prisma types is calculated

## 3.29.0

### Minor Changes

- 76d50bb4: Fix import of cjs graphql file in esm pothos

## 3.28.0

### Minor Changes

- 390e74a7: Add `idFieldOptions` to relay plugin options

## 3.27.2

### Patch Changes

- 193ac71a: Support `fullTextSearch` types (#553)

## 3.27.1

### Patch Changes

- 222298f0: update curor type on query arg of prismaConnections

## 3.27.0

### Minor Changes

- c5b1e2d3: move addBrand and hasBrand from PrismaNodeRef to PrismaObjectRef so it can be used with
  all prisma objects
- c5b1e2d3: Only use abstractReturnShapeKey when resolveType is not provided

## 3.26.0

### Minor Changes

- 5423703a: expose queryFromInfo from prisma plugin

## 3.25.0

### Minor Changes

- 82596ec2: remove duplicate Fields from generated prisma types

## 3.24.0

### Minor Changes

- 5e71c283: update queryFromInfo to support indirect paths

## 3.23.0

### Minor Changes

- 33789284: Update cursor encoding to work in deno
- 33789284: Fix default connection size when using "before"
- 33789284: Support setting max and default cursor sizes based in args or context

## 3.22.0

### Minor Changes

- 13216a3d: remove all remaining circular imports

## 3.21.2

### Patch Changes

- c102f522: Fix withAuth on prismaObject fields builders

## 3.21.1

### Patch Changes

- a02b25c2: Fix regression in compatibility between prisma and simple objects plugins"

## 3.21.0

### Minor Changes

- 3ead60ae: Add option to use comments from prisma schema as graphql descriptions

### Patch Changes

- 3ead60ae: update dev deps

## 3.20.0

### Minor Changes

- f7f74585: Add option for configuring name of id field for relay nodes

## 3.19.0

### Minor Changes

- 6382f65b: Fix types when using prismaField with `select` on a PrismaObject

## 3.18.0

### Minor Changes

- 360836e5: Fix issue with prismaField not inferring parent thpe for subscriptions

## 3.17.0

### Minor Changes

- c50b9197: Support BigInt cursors

## 3.16.0

### Minor Changes

- 86c16787: Allow dmmf to be passed from Prisma.dmmf

## 3.15.0

### Minor Changes

- dad7fb43: Fix typing for fallback resolvers on relation fields, and correclty pass all query
  properties for relatedConnections

## 3.14.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 3.13.2

### Patch Changes

- f58ad8fa: Fix type error introduced by withAuth helper

## 3.13.1

### Patch Changes

- 04ed2b0c: Fix args in plugin methods on connection fields sometimes not being typed correctly

## 3.13.0

### Minor Changes

- 7311904e: Support uniqueIndexes as connection cursors
- 7311904e: Add withAuth method to return a field builder to allow custom auth context with other
  plugin methods
- 7311904e: Use findUniqueOrThrow rather than rejectOnNotFound if available

### Patch Changes

- 7311904e: Fix connection with empty select
- 7311904e: Update dev deps

## 3.12.1

### Patch Changes

- c8f75aa1: Update dev dependencies

## 3.12.0

### Minor Changes

- 4d414fb5: Add support for prisma@4

## 3.11.0

### Minor Changes

- 79e69c2b: Add resolveCursorConnection helper for relay plugin

## 3.10.0

### Minor Changes

- 384b0fb6: Make findUnique optional by defaulting to id/unique fields defined in prisma schema

## 3.9.0

### Minor Changes

- e090a835: Add fieldWithSelection method to support indirect relions

### Patch Changes

- 4e5756ca: Update dev dependencies

## 3.8.0

### Minor Changes

- 4154edc9: Add isNull option to prisma variant fields

## 3.7.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.6.1

### Patch Changes

- 205a8c73: Recactor internal imports to reduce imports from index files

## 3.6.0

### Minor Changes

- ce1063e3: Add new tracinig packages

### Patch Changes

- ce1063e3: Fix issue with fields selects when created created with functions

## 3.5.0

### Minor Changes

- 05163ca5: Add support for dynamically loading prisma client and selecting counts in field level
  selects"

## 3.4.0

### Minor Changes

- a8e31a70: Improve user experience when srtict mode is disabled

## 3.3.0

### Minor Changes

- 241a385f: Add peer dependency on @pothos/core

## 3.2.0

### Minor Changes

- 6279235f: Update build process to use swc and move type definitions to dts directory

### Patch Changes

- 21a2454e: update dev dependencies

## 3.1.2

### Patch Changes

- 1bf0cd00: Add typescript version check for prisma generator

## 3.1.1

### Patch Changes

- 86718e08: Make lookups on extensions objects compatible with older graphql versions

## 3.1.0

### Minor Changes

- 8add0378: Add `totalCount` option to `prismaConnection`

## 3.0.0

### Minor Changes

- 9b6353d4: Use Promise.resolve instead of setTimeout to batch fallback operations

## 0.19.0

### Minor Changes

- cf4a2d14: Add support for using selects instead of includes in queries

## 0.18.0

### Minor Changes

- ad8d119b: Add support for composite ids as cursors in connections

### Patch Changes

- ad8d119b: update dev dependencies

## 0.17.2

### Patch Changes

- 03aecf76: update .npmignore

## 0.17.1

### Patch Changes

- c288534e: correctly load type includes when resolving prismaNodes

## 0.17.0

### Minor Changes

- 4ad5f4ff: Normalize resolveType and isTypeOf behavior to match graphql spec behavior and allow
  both to be optional

### Patch Changes

- 43ca3031: Update dev dependencies

## 0.16.3

### Patch Changes

- ab4a9ae4: Fix some type compatibility issues when skipLibCheck is false

## 0.16.2

### Patch Changes

- 2d9b21cd: Use workspace:\* for dev dependencies on pothos packages

## 0.16.1

### Patch Changes

- b58ee414: Fix primaNode variants

## 0.16.0

### Minor Changes

- 044396ea: Add support for multiple variants of the same prisma model

## 0.15.2

### Patch Changes

- a01abb7f: Fix compatability between prisma and auth plugins

## 0.15.1

### Patch Changes

- ce585cca: fix Prisma object parent shape when combined with other plugins

## 0.15.0

### Minor Changes

- 4caad5e4: Rename GiraphQL to Pothos

## 0.14.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 0.13.3

### Patch Changes

- 2b08f852: Fix syntax highlighting in docs and update npm README.md files"

## 0.13.2

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

## 0.13.1

### Patch Changes

- 5619aca: Standardize context caches across all plugins to correctly take advantage of
  `initContextCache`

## 0.13.0

### Minor Changes

- 6d2a6d9: Update to support typescript 4.5. typescript@>4.5.2 is now required for code generation
  in the prisma plugin

## 0.12.1

### Patch Changes

- c85dc33: Add types entry in package.json

## 0.12.0

### Minor Changes

- aeef5e5: Update dependencies

## 0.11.1

### Patch Changes

- 8e7cb89: remove some debug code

## 0.11.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

### Patch Changes

- 53e7905: Correctly pass context to query option of relations and connectedRelations

## 0.10.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 0.9.2

### Patch Changes

- c976bfe: Update dependencies

## 0.9.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 0.9.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 0.8.2

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

## 0.8.1

### Patch Changes

- 0d655cd: Update README.md

## 0.8.0

### Minor Changes

- f04be64: #### Breaking
  - The Prisma plugin had been re-designed to use a prisma-generator to generate more efficient
    types. This requires new additional setup
  - Restored the original API that used model names as strings rather than passing in prisma
    delegates.

  #### New
  - Added support for `include` options on `prismaObject` and `prismaNode` types that are
    automatically loaded. This allows fields defined directly on those types to use nested relations
    without making additional requests.
  - Added `relationCount` method to prisma field builder and `totalCount` option to
    `relatedConnection` for more loading of counts.

  ### Fixed
  - Fixed some bugs related to field nullability
  - Improved include merging to further reduce the number of queries required to resolve a request

### Patch Changes

- f04be64: Update dependencies

## 0.7.2

### Patch Changes

- cbb4960: Fix priama-connections without relations

## 0.7.1

### Patch Changes

- 2cf9279: fix for models that do not have any relations

## 0.7.0

### Minor Changes

- ea4d456: Add interoperability between prisma and errors plugins

## 0.6.0

### Minor Changes

- 5cdd001: Re-designed how types are propagated in the prisma plugin to improve performance. This
  requires a few breaking changes to how this plugin is used.

  This change was required because of performance issue in typescript which has been reported here:
  https://github.com/microsoft/TypeScript/issues/45405

  If this is fixed, the API may be changed back to the slightly nicer string/name based version.

  You will need to remove PrismaClient from the builder types, so your builder setup now looks like:

  ```typescript
  import PrismaPlugin, { PrismaTypes } from "@giraphql/plugin-prisma";

  export default new SchemaBuilder<{}>({
    prisma: {
      client: prisma,
    },
  });
  ```

  You will also need to replace model names with the prisma delegates from your prisma client like
  the following:

  ```typescript
  builder.prismaObject(prisma.post, {
    findUnique: (post) => ({ id: post.id }),
    fields: (t) => ({
      id: t.exposeID("id"),
      title: t.exposeString("title"),
      author: t.relation("author"),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      me: t.prismaField({
        type: prisma.user,
        resolve: async (query, root, args, ctx, info) =>
          prisma.user.findUniqueOrThrow({
            ...query,
            where: { id: ctx.userId },
          }),
      }),
    }),
  });
  ```

  See updated docs for more detailed usage.

## 0.5.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

## 0.4.0

### Minor Changes

- 06e11f9: Pass context to query option of relation and relatedConnection fields

### Patch Changes

- 0d51dcf: Fix nullability of prismaField

## 0.3.2

### Patch Changes

- ee16577: Fix prisma plugin for multi-word model names.
- f13208c: bump to fix latest tag

## 0.3.1

### Patch Changes

- 9ab8fbc: re-release previous version due to build-process issue

## 0.3.0

### Minor Changes

- 3dd3ff14: Updated dev dependencies, switched to pnpm, and added changesets for releases

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 0.2.1 - 2021-08-05

#### 📘 Docs

- fix typo ([ef5cff9](https://github.com/hayes/giraphql/commit/ef5cff9))
- fix typo ([dbe3e0e](https://github.com/hayes/giraphql/commit/dbe3e0e))
- fix typo ([eaec7b9](https://github.com/hayes/giraphql/commit/eaec7b9))
- fix typo ([2c366f0](https://github.com/hayes/giraphql/commit/2c366f0))
- improve description of supported connection arguments
  ([e697727](https://github.com/hayes/giraphql/commit/e697727))
- update disclaimer section of prisma docs
  ([4c375cd](https://github.com/hayes/giraphql/commit/4c375cd))

**Note:** Version bump only for package @giraphql/plugin-prisma

## 0.2.0 - 2021-08-03

#### 🚀 Updates

- add relay integration for prisma plugin
  ([e714e54](https://github.com/hayes/giraphql/commit/e714e54))

#### 🐞 Fixes

- merge connection args into relatedConnection queries
  ([762c06f](https://github.com/hayes/giraphql/commit/762c06f))
- update db seeding to give unique createdAt
  ([279349d](https://github.com/hayes/giraphql/commit/279349d))

#### 📘 Docs

- add docs for prisma relay integration
  ([6c6cbd5](https://github.com/hayes/giraphql/commit/6c6cbd5))

#### 🛠 Internals

- update tests with seed data ([f3b053a](https://github.com/hayes/giraphql/commit/f3b053a))

**Note:** Version bump only for package @giraphql/plugin-prisma

### 0.2.0-alpha.1 - 2021-08-02

#### 🐞 Fixes

- merge connection args into relatedConnection queries
  ([cd72880](https://github.com/hayes/giraphql/commit/cd72880))

#### 🛠 Internals

- update tests with seed data ([56fbb7b](https://github.com/hayes/giraphql/commit/56fbb7b))

**Note:** Version bump only for package @giraphql/plugin-prisma

## 0.2.0-alpha.0 - 2021-08-02

#### 🚀 Updates

- add relay integration for prisma plugin
  ([0b1d378](https://github.com/hayes/giraphql/commit/0b1d378))

**Note:** Version bump only for package @giraphql/plugin-prisma

## 0.1.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/plugin-prisma
