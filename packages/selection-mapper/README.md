# @pothos/selection-mapper

The selection-to-query walker shared by `@pothos/plugin-prisma` and `@pothos/plugin-drizzle`. It
turns the selection set a resolver receives into the ORM plugin's own query format, through
fragments, variants, directives, and indirect includes, and records the loader mappings the
plugins' field resolvers look up at resolve time.

This package is an implementation detail of those plugins. Its exports exist for them and change
with them: it is not a supported public API, and its versions carry no compatibility promise of
their own. Use the plugins.

The surface is what the three plugins import and nothing more: `Plan` (with `Plan.fromInfo` and
`Plan.forParentRow` on it), `Adapter` and `NodeAdapter`, the loader-map helpers (`cacheKey`,
`getLoaderMapping`, `setFieldMapping`, `setLoaderMappings`, `setRowMappings`), `selectedFieldNames`
and `deepEqual`. A rule only one plugin wants belongs to that plugin: turning a plan into the
query a resolver is handed is prisma's `queryFromInfo`, drizzle's, and prisma-next's, each
different, so none of them is here.

## Vocabulary

- **Selection** — what the GraphQL document asks for: a `SelectionNode`, a selection set, a
  fragment. Always the input side; graphql-js owns the word.
- **Query** — what the ORM is told to load, in the ORM's own format (prisma
  `{ select, include, ...args }`, drizzle `DBQueryConfig`). Opaque to the walker: it hands queries
  to the adapter and returns what the adapter serializes. The `Query` type parameter everywhere.
- **Model** — the adapter's description of one table or prisma model, one object per model, so
  model identity is model equality.
- **Node** — one level of the query being built (a model, its columns, its relations, its computed
  values), and the tree of them one root accumulates into (`Node`, `node.ts`). The adapter owns
  the shape; the walker reads only `node.model`. `NodeAdapter` is the adapter over that tree: it
  holds every merge, compare and conflict rule the two ORM plugins used to write out for
  themselves.
- **Plan** — what a traversal collected for one root: the model it loads, the selection it starts
  from, and the merges it collected, in order. A plan holds no node, and owns its own fold and
  its own pending chain (`Plan`), and the two entry points as statics: `Plan.fromInfo` (E-1, the
  plan for the field a resolver was called for) and `Plan.forParentRow` (E-2, the plan loading
  that field for its parent row, already played). `plan.nested()` makes a child plan.
- **Merge (noun)** — one item in a plan's list: a type's selection, a variant's, a nested
  selection's relation query, or a field's, each with the query the adapter produced for it and,
  for a field, the mapping to record if it is taken (`RootMerge`).
- **Play** — to fold a plan's merges into a fresh node, in order, behind a seed selection
  (`plan.play()`). Every merge is offered to the node being built, so this is where one is accepted or
  rejected and the only place a mapping is recorded — the traversal decides none of it. A plan can
  be played any number of times, behind a different seed each time; a play owns its node
  (`PlayedPlan`), so a caller may merge into what it gets back.
- **Walk** — only ever the verb: to read a selection into a plan (`walkBranches`, `walkField`,
  `walkSelections`). Never a noun.
- **Level** — one selection set as the shared traversal reads it: the type it is read as, the type
  the next field is expected on, the alias path that reached it, and whether a `@defer` was
  crossed. `eachSelectedField` reads one level, descends into the fragments beneath it, and hands
  every field that applies to a visitor; matching an indirect-include path, collecting the
  selected field names, and finding one field node are all that one traversal with three visitors.
- **Branch** — one selection set (or several, for one field selected under several fragments) with
  the type to walk it as: the unit `walkBranches` takes.
- **Merge (verb)** — to fold a query into a node, through the adapter (`mergeQuery`), or one node
  into another (`mergeNode`). `canMergeQuery` and `canMergeNode` ask the same question without
  doing it: whether merging would leave everything already selected as it is.
- **Entry** — one key of a query as the adapter reads it: a column, every column, a relation, a
  computed value, or the query's arguments. `Adapter.eachEntry` reports each of them to an
  `EntryVisitor`, and the visitor alone decides what to do with it, so merging, checking and
  conflict-finding share one key loop per ORM.
- **Computed value** — what a node holds that is neither a column nor a relation: a value the ORM
  computes per row (prisma's `_count` entries, drizzle's `extras`). `node.computed` in the shared
  contract; each ORM keeps its own word for it in what its users read.
- **Adapter** — the ORM boundary, one class: how to find a type's model and what a type and a
  field select, and how those selections accumulate into a node (`Adapter`, `NodeAdapter`).
- **Mapping** — what a play records for a field whose merge it took, so the field's resolver can
  find its data in the loaded row; absent means the resolver loads its own data.
- **Position** — where a field is: a link of `{ parent, type, field, node }` running back to the
  field an entry point was called for, handed to a select function and recorded with the field's
  mapping.
- **Match** — a field found at the end of an indirect-include path.
- **Enter** — to merge a type's type-level selection into a node, once, before its fields are
  walked.

## The adapter contract

An ORM plugin subclasses `Adapter<Model, Query, NodeType>`. Six members must be answered: three
translate the schema — `modelFor` (a type's `Model`), `typeSelection` and `fieldSelection` (what
a type and a field select, in the ORM's own `Query` format) — and three accumulate —
`createNode` for a model, `mergeQuery` into one, `toQuery` for the node written back out. The
traversal reads nothing of a node but its `model`, and nothing of a query at all.

The four members below those are the merge rules, and each is inherited with the answer an
adapter that never shares a slot between two consumers wants: `canMergeQuery` (M-3) is true,
`firstConflict` (S-7) is none, and `mergeNode` and `canMergeNode` round-trip through `toQuery`.
`canMergeQuery` and `firstConflict` ask the same thing of different callers: one is the yes or no
a play gates a merge on, the other names the first offending entry for an error message. An
adapter that gives every consumer its own slot therefore writes six methods and nothing more.
`MergeOptions` says
how one merge differs from a plain one: `asQuery` (E-3, a relation query adds no columns),
`lenient` (E-2, conflicting entries are left out), `ignoreArgs` (M-3), and the `alias` the query
came from, so an adapter may merge same-named relations into one node (prisma, drizzle) or keep
one slot per selected field. `skipDeferredFragments` (S-8) defaults to true.

`NodeAdapter<Model, Query>` is what the prisma and drizzle adapters extend: the node tree of
`node.ts` (columns, relations, computed values, arguments) with every merge rule this package
owns. A subclass writes `eachEntry`, the key loop of its own query, reported entry by entry to an
`EntryVisitor`; `toQuery`, the node written back; and optionally `computedConflicts` when its
computed values are not compared by value — three methods on top of the three translation ones.
The visitor is reused down the tree, so a merge allocates only what the subclass's own key loop
already allocated. An ORM whose query is not a tree of columns, relations and computed values
extends `Adapter` directly.

Every select function is handed the `Position` of the field it plans: the field's node, the type
it was walked on, and a link to the position of the field the plan hangs beneath, running back to
the field an entry point was called for. The walker reads none of it — an adapter that wants a
path or a list of segments walks `parent` and materializes its own — and records it with the
field's mapping, so a resolver can ask the same question the select path asked. An adapter that
never looks at a position pays for one link per select function and no arrays.

Every play records its loader mappings on the request context, which pothos requires to be an
object; an adapter whose resolvers read a loaded row another way simply never looks them up.

A merge holds the query the adapter produced for it by reference, and a play merges that same
object however many times the plan is played. A select function that returns a query and then
mutates it changes what a later play builds; nothing copies it, because a query is opaque to this
package and could only be copied by round-tripping it through the adapter on every field.

## Rule tags

Comments cite rules as `S-1`, `E-2`, `M-3`, and so on: `S` selection, `E` entry point, `M` merge,
`W` walk order, `A` async, `D` adapter-owned data, `L` loader mappings. The document that states
them is not in this repository, but nearly every rule is stated where it is defined: in the doc
comment of the function that implements it, or in the name of the test that pins it (`A-6`, `D-5`,
`L-1`, `W-1`, `W-2`, `W-3`, `W-11` live in test names). Treat a bare tag as a cross-reference to
that site.

Two rules are cited only from the plugins, which have no doc comment that states them, so they
are stated here — as every rule with no other home should be:

- **A-5** — a field's `query` may be async, and what is built from it is then a promise. Every
  plugin API that takes one returns a `MaybePromise`, and a caller awaits it or hands it on.
- **L-4** — the loader fallback keeps one plan per `Type@path` per request, played where it is
  made, so every row of a type loaded for the same path is loaded with the same selection.
