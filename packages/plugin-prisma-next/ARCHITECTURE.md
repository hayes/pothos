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
| `src/index.ts` | Plugin class. `onTypeConfig` (precompute relation metadata, M:N rejection). `wrapResolve` (Collection auto-detect + materialize; per-field overlay for combine slots). |
| `src/schema-builder.ts` | `builder.prismaObject` / `prismaInterface` / `prismaNode` / `prismaObjectField(s)` / `prismaInterfaceField(s)`. |
| `src/prisma-next-field-builder.ts` | `t.prismaField` / `t.prismaFieldWithInput` on `RootFieldBuilder`. |
| `src/prisma-next-connection.ts` | `t.prismaConnection` on `RootFieldBuilder`. |
| `src/prisma-next-object-field-builder.ts` | `PrismaNextObjectFieldBuilder`: `t.relation` / `t.relatedConnection` / `t.variant` / `t.expose*` / `t.withAuth`. |
| `src/connection-helpers.ts` | `prismaConnectionHelpers` — public composable for custom paginators. |
| `src/utils/apply-selection.ts` | The walker. Public entry: `applySelectionToCollection`. |
| `src/utils/branding.ts` | `rebrandForVariant` (used by `t.variant` only). |
| `src/utils/refs.ts` | Per-builder ref cache (drizzle shape). |
| `src/utils/cursors.ts` | Cursor encode/decode + pagination predicate builders. |
| `src/utils/node-batch.ts` | Per-request micro-batching for `prismaNode.load`. |
| `src/utils/total-count.ts` | `buildTotalCountPromise` + `wrapConnectionOptionsWithTotalCount`. |
| `src/object-ref.ts` / `interface-ref.ts` / `node-ref.ts` | The three ref classes. |
| `src/constants.ts` | Extension keys: `pothosPrismaNextModel`, `pothosPrismaNextPrepared`, `pothosPrismaNextSelect`, `pothosPrismaNextRelations`. |

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
   per relation as `pothosPrismaNextRelations`. M:N relations throw
   here (fail-fast — the walker doesn't know how to join junctions).

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

`applySelectionToCollection(baseCollection, info, contract, ctx, opts)`
emits the chain inline. It does not build an intermediate tree: each
level's state is a `LevelAcc` that lives only inside one stack frame.

For one level (one GraphQL selection set on one type):

```
LevelAcc {
  columns: Set<string>            → emitted as base.select(...columns)
  relations: Map<name, RelationAcc>  → emitted as base.include(rel, cb)
}
RelationAcc {
  isToMany
  branches: Map<alias, BranchAcc>     // refined includes per alias
  counts: Map<alias, CountAcc>        // legacy peer counts (unused on current path)
  specFunctions: RelationSpecFn[]     // function-form select callbacks
  parentFkColumns: string[]           // FK cols to merge into parent SELECT
}
```

Each field in the selection set drops contributions into the level:

- `t.expose*` writes `pothosExposedField` = column name → walker calls
  `level.columns.add(name)`.
- `t.relation`/`t.relatedConnection`/`t.field({ select })` write
  `pothosOptions.select` on the field config. The walker reads it,
  resolves callbacks (with `args + ctx`), and adds branches or spec
  functions to the relevant `RelationAcc`.
- Type-level `pothosPrismaNextSelect` (from `prismaObject({ select })`)
  is applied at the start of every descent — declared columns always
  load, declared relations get a default branch.

After collecting, the walker runs **FK augmentation**: every relation
that ended up in the level merges its `parentFkColumns` into
`level.columns`. This is the workaround for prisma-next's nested-stitch
plan needing the parent's FK on depth-2+ includes. The metadata comes
from the precomputed `pothosPrismaNextRelations` extension — the walker
never touches the contract.

Then **emission**:

```
acc = base.select(...columns)
for each relation:
  if single consumer (one branch, no count, no spec-fn):
      acc = acc.include(name, cb => emitBranch(cb))   // fast path
  else:
      acc = acc.include(name, cb => cb.combine(specObject))  // multi-consumer
```

The single-consumer fast path matters because prisma-next's SQL planner
falls back to multi-query whenever an include uses `.combine` (painpoint
#3). We bias toward the fast path whenever possible.

### Indirect-include descent

`pothosIndirectInclude` is a field- or type-level extension that tells
the walker to redirect:

- `{ getType }` — same-row redirect. Walk the named type's selections
  on the same parent row. Used by `t.variant`.
- `{ getType, paths }` — descend through named paths. Used by
  `t.relatedConnection` (paths into `edges.node` and `nodes`) and by
  `@pothos/plugin-errors` (paths into a result-union's `data` field).

Both forms thread through `resolveIndirectInclude` /
`resolveIndirectIncludePaths` in `apply-selection.ts`.

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

Sugar that compiles to a `t.connection` field with a function-form
`pothosOptions.select`. Pagination lives INSIDE the include refinement,
so the parent + the page rows ship as one SQL plan whenever prisma-next
can collapse it:

```
select: (_args, _ctx, info, fieldSelection, connectionType) => ({
  [relationName]: (sub, args, ctx) => {
    const filtered = userWhere?.(sub) ?? sub
    const paginated = applyCursorPagination(filtered, cursor, args, sizes)
    const withCols = applySelectionToCollection(paginated.collection, info,
      contract, ctx, { paths: [['edges','node'], ['nodes']], extraColumns: cursorCols, ... })
    return wantsTotalCount
      ? { rows: withCols, count: filtered.count() }
      : { rows: withCols }
  },
})
```

The connection field's resolver reads `parent.rows` and (optionally)
`parent.count` from the per-field overlay, re-builds the pagination
state to encode cursors, and returns the Relay connection page.

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
  types. The walker honors type-level indirect-includes
  (`apply-selection.ts:walkField`) and descends into the union's `data`
  field, so wrapping a Connection or relation in a result-union "just
  works" — no errors-plugin-specific code in this plugin.
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
- M:N relations rejected at schema build until the contract carries
  junction columns (painpoint #7).
