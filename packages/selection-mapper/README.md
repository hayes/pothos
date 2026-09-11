# @pothos/selection-mapper

The selection-to-query walker shared by `@pothos/plugin-prisma` and `@pothos/plugin-drizzle`. It
turns the selection set a resolver receives into the ORM plugin's own query format — through
fragments, variants, directives and indirect includes — and records the loader mappings the
plugins' field resolvers look up at resolve time.

This package is an implementation detail of those plugins. Its exports exist for them and change
with them: it is not a supported public API, and its versions carry no compatibility promise of
their own. Use the plugins.

The surface is what those plugins import and nothing more: `Plan` (with the statics `Plan.fromInfo`
and `Plan.forParentRow`), `Adapter` and `NodeAdapter`, the loader-map helpers (`cacheKey`,
`getLoaderMapping`, `setFieldMapping`, `setLoaderMappings`, `setRowFieldMapping`,
`setRowMappings`), `selectedFieldNames` and `deepEqual`. Turning a plan into the query a resolver
is handed is each plugin's own job — prisma's `queryFromInfo` and drizzle's differ — so neither of
them is here.

## Vocabulary

- **Selection** — what the GraphQL document asks for: a `SelectionNode`, a selection set, a
  fragment. Always the input side; graphql-js owns the word.
- **Query** — what the ORM is told to load, in the ORM's own format (prisma
  `{ select, include, ...args }`, drizzle `DBQueryConfig`). Opaque to the walker, which hands
  queries to the adapter and returns what the adapter serializes. The `Query` type parameter.
- **Model** — the adapter's description of one table or prisma model. One object per model, so
  model identity is model equality.
- **Node** — one level of the query being built (a model, its columns, its relations, its computed
  values), and the tree of them one root accumulates into. The adapter owns the shape; the walker
  reads only `node.model`.
- **Plan** — what a traversal collected for one root: the model it loads, the selection it starts
  from, and the merges it collected, in order. A plan holds no node.
- **Merge** — one item in a plan's list: a type's selection, a variant's, a nested selection's
  relation query, or a field's, each with the query the adapter produced for it.
- **Play** — to fold a plan's merges into a fresh node, in order, behind a seed selection. Every
  merge is offered to the node being built, so this is where one is accepted or rejected and the
  only place a mapping is recorded. A plan can be played any number of times, behind a different
  seed each time, and a play owns its node, so a caller may merge into what it gets back.
- **Computed value** — what a node holds that is neither a column nor a relation: a value the ORM
  computes per row (prisma's `_count` keys, drizzle's `extras`). `node.computed` in the shared
  contract; each ORM keeps its own word for it in what its users read.
- **Mapping** — what a play records for a field whose merge it took, so the field's resolver can
  find its data in the loaded row; absent means the resolver loads its own data.
- **Position** — where a field is: a link of `{ parent, type, field, node }` running back to the
  field an entry point was called for, handed to a select function and recorded with the field's
  mapping.

## The adapter contract

An ORM plugin subclasses `Adapter<Model, Query, NodeType>`. Six members must be answered: three
translate the schema — `modelFor` (a type's `Model`), `typeSelection` and `fieldSelection` (what a
type and a field select, in the ORM's own `Query` format) — and three accumulate — `createNode`
for a model, `mergeQuery` into one, `toQuery` for the node written back. The traversal reads
nothing of a node but its `model`, and nothing of a query at all.

The four members below those are the merge rules, and each is inherited with the answer an adapter
that never shares a slot between two consumers wants: `canMergeQuery` is true, `firstConflict` is
none, and `mergeNode` and `canMergeNode` round-trip through `toQuery`. `canMergeQuery` and
`firstConflict` ask the same thing of different callers: one is the yes or no a play gates a merge
on, the other names the first offending key for an error message. An adapter that gives every
consumer its own slot therefore writes six methods and nothing more.

`MergeOptions` says how one merge differs from a plain one: `asQuery` (a relation query adds no
columns), `lenient` (conflicting keys are left out rather than refused), `ignoreArgs` (the node's
own top-level arguments are not compared), and the `alias` the query came from, so an adapter may
merge same-named relations into one node (prisma, drizzle) or keep one slot per selected field.
`skipDeferredFragments` defaults to true.

`NodeAdapter<Model, Query>` is what the prisma and drizzle adapters extend: the node tree of
`node.ts` (columns, relations, computed values, arguments) with every merge rule this package
owns. A subclass writes `visitQuery`, the key loop of its own query, reported key by key to a
`QueryVisitor`; `toQuery`, the node written back; and optionally `computedConflicts` when its
computed values are not compared by value — three methods on top of the three translation ones.
The visitor is reused down the tree, so a merge allocates only what the subclass's own key loop
already allocated. An ORM whose query is not a tree of columns, relations and computed values
extends `Adapter` directly.

## What an adapter must uphold

- A field's `query` may be async, and what is built from it is then a promise. Every API that
  takes one returns a `MaybePromise`, and a caller either awaits it or hands it on.
- A merge holds the query the adapter produced for it by reference, and a play merges that same
  object however many times the plan is played. A select function that returns a query and then
  mutates it changes what a later play builds. Nothing copies it, because a query is opaque to
  this package and could only be copied by round-tripping it through the adapter on every field.
- Every play records its loader mappings on the request context, which pothos requires to be an
  object; an adapter whose resolvers read a loaded row another way simply never looks them up.
- Every select function is handed the `Position` of the field it plans: the field's node, the type
  it was walked on, and a link to the position of the field the plan hangs beneath. The walker
  reads none of it — an adapter that wants a path or a list of segments walks `parent` and
  materializes its own — and records it with the field's mapping, so a resolver can ask the same
  question the select path asked.
