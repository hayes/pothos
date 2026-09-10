# Architecture — `@pothos/plugin-prisma-next`

A working note for maintainers. Tracks how the plugin is wired and why
the runtime hot path looks the way it does. Companion to `REVIEW.md`
(the latest refactor decisions) and the user-facing docs under
`website/content/docs/plugins/prisma-next/`.

## What the plugin actually does

Two things, at request time:

1. Walks `info` (the GraphQL selection set the resolver received) and
   emits the orm-client chain — `.select(...)`, `.include(rel, cb)`,
   `.combine({...})` — onto whatever `Collection` the user returned.
2. Materializes that Collection via `.all()` and hands the rows back to
   GraphQL.

Everything else (refs, branding, sugar field builders) is plumbing
around those two steps.

## File map

| Path | What lives here |
|---|---|
| `src/index.ts` | Plugin class. `onTypeConfig` (precompute relation metadata, unknown-cardinality rejection). `wrapResolve` (Collection auto-detect + materialize; per-field overlay for combine slots). |
| `src/schema-builder.ts` | `builder.prismaObject` / `prismaInterface` / `prismaNode` / `prismaObjectField(s)` / `prismaInterfaceField(s)`. |
| `src/prisma-next-field-builder.ts` | `t.prismaField` / `t.prismaFieldWithInput` on `RootFieldBuilder`. |
| `src/prisma-next-connection.ts` | `t.prismaConnection` on `RootFieldBuilder`. |
| `src/prisma-next-object-field-builder.ts` | `PrismaNextObjectFieldBuilder`: `t.relation` / `t.relatedConnection` / `t.variant` / `t.expose*` / `t.withAuth`. |
| `src/connection-helpers.ts` | `prismaConnectionHelpers` — public composable for custom paginators. |
| `src/utils/adapter.ts` | The `@pothos/selection-mapper` adapter: the node, the spec map, the compile of `select` shapes, and `emit` (spec → builder chain). |
| `src/utils/map-query.ts` | Public entry: `applySelectionToCollection` over `Plan.fromInfo` / `plan.query()`. |
| `src/utils/model.ts` | One `PrismaNextModel` per contract model (relations with resolved targets, column set), built from the contract. |
| `src/utils/branding.ts` | `rebrandForVariant` (used by `t.variant` only). |
| `src/utils/refs.ts` | Per-builder ref cache (drizzle shape). |
| `src/utils/cursors.ts` | Cursor encode/decode + pagination predicate builders. |
| `src/utils/node-batch.ts` | Per-request micro-batching for `prismaNode.load`. |
| `src/utils/total-count.ts` | `buildTotalCountPromise` + `wrapConnectionOptionsWithTotalCount`. |
| `src/object-ref.ts` / `interface-ref.ts` / `node-ref.ts` | The three ref classes. |
| `src/constants.ts` | Extension keys: `pothosPrismaNextModel`, `pothosPrismaNextPrepared`, `pothosPrismaNextSelect`, `pothosPrismaNextRelations`, `pothosPrismaNextFieldSelect`. |

## Schema build

When the user calls `builder.prismaObject('User', ...)`, the plugin:

1. Looks up or lazily creates a `PrismaNextObjectRef` keyed by typeName
   (drizzle-shape — see `src/utils/refs.ts`). Variants get fresh refs.
2. Registers the underlying `objectType` with two extensions stamped on
   the config: `pothosPrismaNextModel` (the contract model name) and,
   if `select` was passed, `pothosPrismaNextSelect` (the always-load
   spec).
3. Inside `onTypeConfig` the plugin walks every relation declared on
   that contract model and caches `{ isToMany, localFields, targetModel }`
   per relation as `pothosPrismaNextRelations`. An unknown cardinality
   throws here (fail-fast). The adapter reads the same metadata through
   `src/utils/model.ts`, one model object per contract model, so model
   identity is what the walker compares.

For `t.prismaField({ type: 'User', resolve })`, the field builder wraps
the resolver and stamps `pothosPrismaNextPrepared: { modelName, typeName }`
on the field config. `wrapResolve` keys off this extension to install
the auto-include path.

## Request: `t.prismaField`

The wrap runs in this order:

```
1. await user resolver(parent, args, ctx, info)   → Collection | Row | Row[] | null
2. duck-type check: does it look like an orm-client Collection?
   - require .select + .include + .where + .all
3. if yes: applySelectionToCollection(coll, info, ...) → augmented coll
        if single-row field: .take(1)
        await augmented.all() → rows
        return rows[0] ?? null  OR  rows  (based on isListType(returnType))
   if no: pass through (raw rows / null)
4. normalizeRowsForType(rows): lift object-level combine slots to flat
   row props (per-type-namespaced; see Combine slots below).
```

If the user returned rows directly (already materialized), the plugin
only runs step 4 — the auto-include step is skipped. This makes
`t.prismaField({ resolve: () => null })` work as expected.

## The walker

The selection walk is `@pothos/selection-mapper` (the walker shared with
`@pothos/plugin-prisma` and `@pothos/plugin-drizzle`); this plugin
supplies a `PrismaNextAdapter`, a subclass of the walker's `Adapter`,
for prisma-next's builder-chain query format
(`src/utils/adapter.ts`). `applySelectionToCollection(baseCollection,
info, contract, ctx, opts)` (`src/utils/map-query.ts`) runs
`Plan.fromInfo`, serializes the root with `plan.query()`, and emits the
result onto the collection. The plan is synchronous unless a `select`
callback returned a promise, in which case the augmented collection is
a promise the plugin's own consumers await.

The adapter's node, one per level (one selection set on one model):

```
PrismaNextNode {
  model: PrismaNextModel
  columns: Set<string>                    → emitted as base.select(...columns)
  relations: Map<name, {
    meta                                  // isToMany, localFields, target model
    branches: Map<'<alias>:<slot>', { alias, slot, args, refine?, node }>
    functions: Map<alias, fn>             // function-form select entries
  }>                                      → emitted as base.include(rel, cb)
}
```

Its `Map` (what a type or a field hands the walker) is `PrismaNextSpec`:
columns, and relation entries that are a branch (its own nested spec,
a `refine`, the field's `args`, a `slot`), a function-form entry, or
`true`. Every serialized entry carries the alias it was walked under,
so a spec round-trips through `merge` without a key.

Each field with prisma-next-relevant behaviour is compiled once, at
first walk, by `fieldSelection(field, type)`:

- `t.expose*` writes `pothosExposedField` = column name → a static
  `{ columns }`.
- `t.field({ select: [...] })` and an object select of columns only →
  a static `{ columns }`.
- `t.relation` / `t.relationCount` / `t.field({ select })` with relation
  entries write `pothosOptions.select` (a literal or `(args, ctx) =>`
  callback). Compiled to a select function: keys are classified against
  the parent model (a typo throws `select: 'x' is not a column or
  relation on User`); a `true` or declarative entry is a branch whose
  nested spec is `nested(query)`, the walk of the field's own selection
  set as its return type; a function entry is stored and run at emit
  time against the relation collection.
- `t.variant` writes a field-level `pothosIndirectInclude { getType }`
  (no path) → a select function returning `nested(true)`, the variant
  type's selection set walked on the same row, plus the forced columns
  of its `select` option.
- `t.relatedConnection` precompiles its own select function into
  `pothosPrismaNextFieldSelect` (see Connections).
- Type-level `pothosPrismaNextSelect` (`prismaObject({ select })`) is
  compiled once per type and merged whenever the walker enters the type,
  slotted under `:object:<Type>`.

`merge` adds a spec to a node: columns union; each relation entry lands
in its `<alias>:<slot>` branch (unioned when the walker applies the same
field twice — two fragments selecting it — and refused when the two
arrive with different arguments), function entries by alias. Getting a
relation for the first time runs **FK augmentation**: the relation's
`localFields` (the parent-side join columns) go into the node's columns,
the workaround for prisma-next's nested-stitch plan needing the parent's
FK on depth-2+ includes. The adapter extends `Adapter` directly and
answers its six members and no more: every consumer has its own slot, so
nothing conflicts, and the four merge rules are inherited from the base
class ("nothing conflicts", "nothing to leave out"). Rows are read back
through the per-resolve overlay, so the loader
mappings the plan records are never looked up.

Then **emission** (`emit`, from the serialized root):

```
acc = base.select(...columns)
for each relation:
  if single consumer (to-one, or one branch and no function entry):
      acc = acc.include(name, cb => emitBranch(cb))   // fast path
  else:
      acc = acc.include(name, cb => cb.combine(specObject))  // multi-consumer
```

The single-consumer fast path matters because prisma-next's SQL planner
falls back to multi-query whenever an include uses `.combine` (painpoint
#3). We bias toward the fast path whenever possible.

### Indirect-include descent

`pothosIndirectInclude` on a **type** (set by `@pothos/plugin-errors` on
result-union types: `{ getType, path: [{ name: 'data' }] }`) is honoured
by the walker itself: a selection on the wrapper is a selection on
`getType()` found under `path`. `paths` given to
`applySelectionToCollection` (`[['edges','node'], ['nodes']]`) and to a
nested selection (`t.relatedConnection`) are matched the same way, and
compose with a wrapper on the field (`prefix`), so a result-union of a
connection works without special-casing.

On a **field**, `pothosIndirectInclude` is the plugin's own marker: the
walker does not read it; the adapter compiles the no-path form into the
`t.variant` same-row descent, and `t.relatedConnection` hands its paths
form to `nested()` as the include to walk.

## Combine slots

When multiple field-builder consumers touch the same relation (e.g. a
plain `posts` field, a filtered `drafts` field, and a `postCount` count
on the same User), the walker drops them into one `.include('posts', cb
=> cb.combine({...}))`. Each consumer gets its own slot under a
GraphQL-forbidden separator:

```
combine slot key  =  <fieldAlias>:<innerKey>
```

For object-level (type-level) selects:

```
combine slot key  =  :object:<TypeName>:<innerKey>
```

`:` is forbidden by GraphQL's Name grammar (`/^[_A-Za-z][_0-9A-Za-z]*$/`),
so combine keys can never be forged from a user alias or relation name.
This is what lets the plugin skip a reserved-alias defense and use a
plain object (not `Object.create(null)`) for the combine spec — see
`REVIEW.md` step 3.

### How combine slots reach resolvers

After `.all()` the orm returns rows shaped like:

```
{ id: '1', firstName: 'Alice',
  posts: { 'drafts:posts': [...], 'postCount:posts': 7, ... } }
```

For each field that uses `select`, the plugin installs a thin
`wrapResolve` that builds a per-resolve overlay over `parent`:

```
overlay = Object.create(parent)
for each row prop value that's an object:
  for each k starting with `<fieldAlias>:`:
    overlay[k.slice(prefix)] = slot[k]
return baseResolver(overlay, args, ctx, info)
```

So inside `t.relation('posts').resolve` the parent's
`posts['drafts:posts']` lifts to `overlay.posts` for the `drafts` field
specifically. Each field sees its own slot under unprefixed keys.

Object-level selects use a similar lift inside `normalizeRowsForType`,
runs once per row on the result of `t.prismaField` rather than per
field.

## Connections

### `t.prismaConnection`

```
1. resolver returns the unpaginated, possibly-filtered Collection
2. apply = createApply({ info, paths: [['edges','node'], ['nodes']], extraColumns: cursorCols })
3. applied = apply(userCollection)
4. paginated = applyCursorPagination(applied, cursor, args, sizes)
5. rowsPromise = paginated.collection.all()
6. countPromise = buildTotalCountPromise(...)   (gated on selecting totalCount)
7. await Promise.allSettled([rowsPromise, countPromise])
8. buildConnectionPage(rows, pagination) → { edges, pageInfo, totalCount? }
```

`totalCount` runs against the user-returned collection (pre-pagination,
post-filter) so it reflects the filtered set, not just the current
page. Edge `cursor` is a memoizing non-enumerable getter — clients
selecting only `nodes` skip the per-row encode.

### `t.relatedConnection`

Sugar that compiles to a `t.connection` field with a precompiled select
function (`pothosPrismaNextFieldSelect`). Pagination lives INSIDE the
include refinement, so the parent + the page rows ship as one SQL plan
whenever prisma-next can collapse it:

```
select: (args, ctx, nested, selectedFieldNode) => {
  const rows = nested(
    { slot: 'rows', columns: cursorCols,
      refine: (rel) => applyCursorPagination(userWhere?.(rel) ?? rel, cursor, args, sizes).collection },
    { getType: () => relatedType, paths: [['edges','node'], ['nodes']] },
  )
  return { relations: { [relationName]:
    totalCount && selectedFieldNode(['totalCount'])
      ? [rows, { fn: (sub) => ({ count: (userWhere?.(sub) ?? sub).count() }) }]
      : rows } }
}
```

The connection field's resolver reads `parent.rows` and (optionally)
`parent.count` from the per-field overlay when the relation went
through `combine` (another consumer, or the count), or the relation
value itself when the connection was its only consumer (fast path),
re-builds the pagination state to encode cursors, and returns the Relay
connection page.

## Relay nodes

`builder.prismaNode('User', { id: { field }, collection, fields })`:

- Registers a `prismaObject` for User.
- Registers a `nodeRef` (from plugin-relay).
- `isTypeOf` = user-provided OR `nodeRef.hasBrand` (matches rows that
  carry the type brand stamped by the batcher).
- `loadWithoutCache` micro-batches concurrent same-path lookups via
  `enqueueNodeLoad`. All entries at the same `pathKey(info.path)` share
  a selection set by GraphQL semantics, so they coalesce into one
  `collection.where(idIn).all()`. Composite IDs JSON-encode the tuple
  and decode via a 2 KiB payload cap (matches the cursor decoder).

## Brands (or rather, the lack of them)

Pothos core's `typeBrandKey` symbol lets refs in abstract positions
(interfaces, unions, Node) carry a type identity on each row. The
plugin does NOT brand rows automatically — `t.prismaField` returns
unbranded rows. Two mechanisms cover the abstract-position cases:

- `prismaNode.loadWithoutCache` brands each batched row before
  resolving, because the row will be returned from the `node(id:)` Node
  field.
- `t.variant` calls `rebrandForVariant(parent, variantTypeName)` in its
  resolver. This `Object.create(parent)`-wraps so sibling variants on
  the same row don't race on the non-configurable brand slot.

Users who need a brand at an arbitrary boundary call `ref.addBrand(row)`
manually — same pattern as `@pothos/plugin-prisma`.

## Cross-plugin interop

- **plugin-relay** — `prismaNode` integrates via `nodeRef`. The brand
  check is the `isTypeOf` fallback when the user doesn't provide one.
- **plugin-errors** — sets `pothosIndirectInclude` on result-union
  types. The shared walker honors type-level indirect-includes and
  descends into the union's `data` field, so wrapping a Connection or
  relation in a result-union "just works" — no errors-plugin-specific
  code in this plugin.
- **plugin-scope-auth** — `t.withAuth(scopes)` on
  `PrismaNextObjectFieldBuilder` returns a derived builder that
  injects `authScopes` into every field-config before
  `createField` runs. Same prototype-override pattern as the core
  field builder.
- **plugin-with-input** — `t.prismaFieldWithInput` delegates to
  `t.fieldWithInput` with the prepared extension stamped. Auto-include
  fires identically.

## Known limits

See `feedback/prisma-next-painpoints.md` for the live list. Highlights:

- `.combine` + `.count()` forces prisma-next's planner to fall back to
  multi-query (painpoint #3). Tests assert `>= 1` SQL captures rather
  than `=== 1` for any path that uses both. Affects `t.relatedConnection
  { totalCount: true }` and any function-form select that emits a
  count alongside rows.
- Depth-2+ nested includes also fall back to multi-query. FK
  augmentation keeps the queries correct; the planner is the bottleneck
  (painpoint #4).
- SQL-only. The mapper emits `.combine` and callback-form `.where`,
  which Mongo's `Collection` shape doesn't have (painpoint #8).
- N:M relations are emitted like any to-many include; prisma-next
  resolves the junction from the contract's `through` (painpoint #7,
  resolved upstream in 0.14).
