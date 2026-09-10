# `@pothos/selection-mapper` friction log — plugin-prisma-next adoption

Findings from adopting the shared walker in `@pothos/plugin-prisma-next`, recorded as they were
hit. Severity: `blocker` (cannot be done in the adapter), `workaround` (done in the adapter, belongs
in the package), `wart` (works but awkward, unclear, or costs more than it should), `pleasant`
(fit well). Package paths are under `packages/selection-mapper/src/`, plugin paths under
`packages/plugin-prisma-next/src/`.

The `diff` blocks below show the package as it stood when each finding was reported. The package
has since folded `Env` into `Walk` (`walk.env.adapter` is `walk.adapter`, `env.modelOf(type)` is
`modelOf(adapter, schema, type)`) and dropped `Adapter.recordsMappings` and
`EntryOptions.replayable`, so read them as proposals rather than as current line references.

## Blockers

None so far.

## Workarounds

### W-1: `fieldSelection(field)` gets a bare `GraphQLField`: no parent type, no schema

**Fixed upstream in 098a01fa**: `fieldSelection(field, type)` receives the walked type. The
adapter classifies `select` keys against `modelFor(type)`; the `PRISMA_NEXT_FIELD` stamp,
`onOutputFieldConfig` and `modelOfType` are removed from the plugin. The return-model half is
covered by A-1's fix (below); the adapter keeps a schema-free guard
(`modelFor(getNamedType(field.type))`) only to skip the descent for a `true` entry on a relation
whose target is known to differ from the field's own model (B-9), which the walker cannot decide
for it.

- Where: `types.ts:118` (`fieldSelection(field: GraphQLField)`), `walk.ts:449` (`applyField` has
  `type` in hand and drops it). Plugin: `index.ts` `onOutputFieldConfig` + `modelOfType`,
  `utils/adapter.ts` `compileFieldSelection`, `constants.ts` `PRISMA_NEXT_FIELD`.
- What the plugin needs: to compile the public `select` option (`{ posts: true, firstName: true,
  postCount: (sub) => ... }`) it must classify every key as a column or a relation of the
  **parent** model (and reject unknown keys with the existing `select: 'x' is not a column or
  relation on User` message), and it must know the model of the field's **return type, seen
  through indirect-include wrappers** (an errors-plugin result union) to decide whether a `true`
  relation entry may call `nested()` at all (see A-1 below).
- What the contract offers: only the `GraphQLField`. A field does not reference its parent type,
  and following `pothosIndirectInclude.getType()` needs the schema, which the adapter never sees
  (`Env` is not handed to adapter methods).
- Workaround: `onOutputFieldConfig` stamps `PRISMA_NEXT_FIELD = { parentModel, returnModel }` on
  every field of a model-backed type (following `pothosIndirectInclude` on type configs through
  `buildCache`). The adapter compiles from the stamp, lazily, cached per `GraphQLField`.
- Smallest upstream change (`types.ts`, `walk.ts`): pass the parent type.
  ```diff
  -  fieldSelection(field: GraphQLField<unknown, unknown>): Map | SelectFn<Map, X> | undefined;
  +  fieldSelection(
  +    field: GraphQLField<unknown, unknown>,
  +    type: WalkedType,
  +  ): Map | SelectFn<Map, X> | undefined;
  ```
  ```diff
  // walk.ts applyField
  -  const selection = adapter.fieldSelection(field);
  +  const selection = adapter.fieldSelection(field, type);
  ```
  The return-model half stays a plugin concern unless A-1 is taken (then the adapter no longer
  needs to know it).

## Warts

### A-1: `nested()` throws when the field's return type has no model

**Fixed upstream in 098a01fa**: a nested selection on a model-less target is the query alone.
The adapter calls `nested(query)` for every `true` / declarative relation entry (the stamped
`returnModel` gate is gone); `tests/adapter.test.ts` "includes a relation entry on a scalar field
without walking beneath it" pins it.

- Where: `walk.ts:558` (`nestedSelectionFor` → `createWalk` → `Expected Int to have a model`).
  Plugin: `utils/adapter.ts` `compileFieldSelection` (`branch:` option, `relation.target ===
  returnModel` guard).
- What the plugin needs: `t.field({ type: 'Int', select: { posts: true }, resolve: (p) =>
  p.posts.length })` is a legal select. The relation entry wants the relation included with no
  selection beneath it; the old walker descended into the field's return type for every `true`
  relation entry and got nothing for a scalar.
- What the contract offers: `nested(query)` always creates a walk of the return type, so on a
  scalar it throws. The adapter cannot ask "does this type have a model" without the schema
  (`modelFor` takes a type; the adapter has the field, whose named return type it can get, but a
  wrapper's include needs `schema.getType`).
- Workaround: the stamped `returnModel` (W-1) gates the call: `relation.target === returnModel ?
  nested(query) : (query ?? {})`.
- Smallest upstream change (`walk.ts` `nestedSelectionFor`): a nested selection of a model-less
  target is the query alone, nothing walked.
  ```diff
  -    const target = include ? info.schema.getType(include.getType())! : returnType;
  -    const child = createWalk(env, target, mapping.nested, extra);
  +    const target = include ? info.schema.getType(include.getType())! : returnType;
  +    if (!env.modelOf(target)) {
  +      // Nothing beneath a model-less field can be planned; the query stands alone.
  +      return rawQuery === true || rawQuery === undefined ? ({} as Map) : (rawQuery as Map);
  +    }
  +    const child = createWalk(env, target, mapping.nested, extra);
  ```
  (With `NestedSelection` typed to say a function query is not called in that case, or called
  and returned.)

### A-2: the root seed dereferences `info.parentType.getFields()`

**Fixed upstream in 098a01fa, then settled for good.** The adapter hook the first fix keyed on
(`Adapter.callbackExtra`) no longer exists: the walker owns the walk position itself and seeds it
for the resolved field, reading `info.parentType?.getFields()`. A hand-built `info` without a
`parentType` plans the same query, only without a position for the field being resolved. The
`parentType` given to the regression fake is reverted.

- Where: `entry.ts`, `positionForResolvedField`. Plugin: `tests/regressions.test.ts`
  "applySelectionToCollection accepts a typeName override" (a hand-built `info` without
  `parentType`, now given one).

### A-3: the context must be an object

**Resolved upstream, the other way round.** `Adapter.recordsMappings` was removed: the walk
always records its loader mappings and always publishes them, and an adapter that reads rows
another way (this one reads them through the per-resolve overlay) simply never looks them up.
The context must therefore be an object, as it must in every pothos plugin — core's own context
cache is a WeakMap keyed on it — so `selectedFieldNames` lost its non-object fallback too.

- Plugin: `contextObject()` is deleted and the context is passed through as is; the
  `buildTotalCountPromise` unit tests pass `{}` instead of `null`, and the adapter no longer
  declares the flag.
- Original report: graphql-js allows any `contextValue`, including none, and the plugin's unit
  tests passed `null`; the old plugin-local walker coerced `(context as object) ?? {}`. With the
  shared package, `setLoaderMappings` keys `createContextCache` on the context and
  `selectedFieldNames` keys a WeakMap on it, so a primitive throws `Invalid value used as weak
  map key`.
- The proposed fix was to skip the record when the adapter records nothing. The maintainer's
  ruling: a flag that makes the walker branch is more complexity than the thing it buys, and
  requiring an object context is already the rule everywhere else in pothos. Recording mappings
  an adapter ignores costs one entry per merged field and nothing else.

### A-4: `selectedFieldNames` needs `info.returnType` and an object `info.variableValues`

**Fixed upstream in 098a01fa** for the context half; the `returnType` read is legitimate and the
`buildTotalCountPromise` fakes keep theirs.

- Where: `matches.ts:104-125` (`byExecution.get(info.variableValues)`, `entryIn(byType,
  getNamedType(info.returnType))`). Plugin: `tests/regressions.test.ts` "buildTotalCountPromise —
  direct unit" (fakes now carry a `returnType`).
- Both are always present on a real `GraphQLResolveInfo`; this only bit hand-built fakes, and the
  read of `returnType` is legitimate (the selection is seen through a wrapper on it). Recording it
  so the maintainer knows the memo's keys are a hidden contract for callers that fake `info`.
- Upstream: nothing needed; a one-line doc note on `selectedFieldNames` would do.

### A-5: `merge` receives no key/alias for type-level, initial, and serialized maps

**Ruled out by the maintainer, deliberately**: `key` is a field key, and a pseudo-key for
type-level merges would overload it, while the serialized round-trip needs per-entry aliases
anyway. The alias stays inside the map (`PrismaNextSpec.alias`).

- Where: `types.ts:127-135` (`merge(node, map, key?, alias?)`: "both are absent for a type-level
  selection, an initial selection, and a loader's staged query"). Plugin: `utils/adapter.ts`
  `PrismaNextSpec.alias`, `requireAlias`, `objectLevelFieldAlias`.
- Every prisma-next relation consumer needs a slot namespace. For a type-level select the adapter
  must invent one (`:object:<Type>`) and, since `merge` gives none, carry it **inside the map**
  (`spec.alias`), and every serialized branch must carry its alias too so `queryFromWalk`'s
  `merge(root, serialize(walk.root))` round-trips. It works (and is what the prototype did), but
  the `Map` grows a field that exists only because one walker call site omits the key.
- Smallest upstream change (`walk.ts` `enter`/`enterVariant`, `entry.ts`): pass the type as the
  key for a type-level selection.
  ```diff
  -    walk.env.adapter.merge(node, selection);
  +    walk.env.adapter.merge(node, selection, `${type.name}@`, undefined);
  ```
  The serialized round-trip still needs per-entry aliases, so this removes only the type-level
  half; a wart, not a workaround.

## Pleasant surprises

- P-1: `getSelectedNode(['totalCount'])` (E-5) replaced the plugin's own
  `selectionSetIncludesField` for the `totalCount: true` gate in `t.relatedConnection`, and sees
  the field through an errors-plugin wrapper on the connection, which the old check did not.
- P-2: `nested(query, include)` with `{ getType, paths: [['edges','node'],['nodes']] }` replaced
  the internal five-argument select signature and the `fieldNode` / `startType` options of the old
  walker: the connection's rows branch is one nested selection. `mergeQuery` carrying the cursor
  columns, the pagination `refine`, and the `rows` slot on the child root fit without a special
  case (`utils/adapter.ts` `mergeQuery`, `prisma-next-object-field-builder.ts` `select`).
- P-3: `initial: { columns }` is exactly `extraColumns` (cursor and id columns), and
  `typeName` is exactly what node batching needed; `queryFromInfo` returning `initial` when nothing
  is selected under `paths` matches the old "pagination only" emission.
- P-4: `merge(node, map, key, alias)`'s `alias` is exactly the plugin's combine-slot namespace
  (`<alias>:<slot>`); `key` (`Type@path.alias`) is unused, which is right: slots are per
  response key on one row, not per path.
- P-5: `selectedFieldNames(context, info)` is memoised per execution, so the resolve-time
  `totalCount` callback gate in `t.relatedConnection` (per parent row) no longer re-walks the
  selection set for every row.
- P-6: `deepEqual` from the package let the adapter refuse the one silent-merge hazard the
  slot-union rule opens (`edges { node { posts(take: 1) } } nodes { posts(take: 2) }`: same
  alias, different arguments) without its own comparer.

## Behaviour changes (walker semantics, on purpose)

- B-1: a relation reached under two fragments on one type merges into one slot instead of
  throwing `Duplicate alias`. The adapter unions the branch (`addBranch`) and throws only when the
  two arrive with different arguments (which GraphQL forbids for one response key in one
  selection set, so this is reachable only across the connection's `edges.node` / `nodes` paths).
- B-2: `... on Node { id }` under an object type is walked (the old `fragmentApplies` required
  the fragment's type to be the walked object type itself).
- B-3: `@skip` / `@include` on fragment spreads and inline fragments are honoured (the old walker
  only checked them on fields).
- B-4: named fragments are expanded once per pass.
- B-5: every `info.fieldNodes` entry is planned into one root (the old walker used
  `fieldNodes[0]`).
- B-6: async `select` callbacks work; `applySelectionToCollection` / `createApply` return a
  promise of the collection only then (A-7), and `materializeCollection`, `prismaNode` batching
  and `t.prismaConnection` await it. `prismaConnectionHelpers.applyPagination` is synchronous by
  its public signature and hands the value through unchanged (plugin API, not a package
  concern).
- B-7: a `t.relatedConnection` that is the only consumer of its relation now takes the
  single-consumer `include` fast path (one query) instead of always going through `combine`;
  the resolver reads `parent.rows ?? parent[relation]`. Old: the connection's function-form
  entry forced `combine` (multi-query in prisma-next).
- B-8: walking an interface type and meeting `... on User` (a same-model object) now enters
  `User`'s type-level select (S-7 `enterVariant`). The old `collectSelections` walked the
  fragment's fields but never applied the fragment type's `PRISMA_NEXT_SELECT`.
- B-9: a `true` relation entry in a `t.field({ select })` is a bare include when the field's own
  return type is backed by another model than the relation's. The old walker descended for every
  `true` entry, so `t.field({ type: [Post], select: { posts: true, comments: true } })` walked
  Post's fields into the `comments` include. Through a wrapper type (an errors-plugin result) the
  adapter cannot see the model and descends, as the walker does.

## Verified prototype guesses

1. `localFields` on the one-to-many side holds the **parent's** join columns (`User.posts` →
   `['id']`, `Post.comments` → `['id']`; N:1 holds the FK, `Post.author` → `['authorId']`), read
   from `on.localFields` for every cardinality (`tests/fixtures/sample-contract.json`, and
   `buildRelationMeta` in `utils/model.ts`). The prototype's fixture was right.
2. The orm-client `Collection` is immutable per call: every builder method (`where`, `orderBy`,
   `take`, `skip`, `select`, `include`, `combine`) returns `this.#clone(...)`
   (`@prisma-next/sql-orm-client/src/collection.ts`), so one relation collection handed to several
   combine branches yields distinct chains, as the prototype's `RecordingCollection` assumed.
3. A type-level select on a `prismaInterface` is allowed (`schema-builder.ts` sets
   `PRISMA_NEXT_SELECT` from `options.select` for interfaces too) and the walker enters it when
   the interface is the walked type (`enter`), and as a variant when a fragment moves an
   interface walk to it. It is not entered when an implementing object type is walked directly
   (neither walker did that; not a regression).
