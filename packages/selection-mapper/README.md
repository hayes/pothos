# @pothos/selection-mapper

The selection-to-query walker shared by `@pothos/plugin-prisma` and `@pothos/plugin-drizzle`. It
turns the selection set a resolver receives into the ORM plugin's own query format, through
fragments, variants, directives, and indirect includes, and records the loader mappings the
plugins' field resolvers look up at resolve time.

This package is an implementation detail of those plugins. Its exports exist for them and change
with them: it is not a supported public API, and its versions carry no compatibility promise of
their own. Use the plugins.

## Vocabulary

- **Selection** — what the GraphQL document asks for: a `SelectionNode`, a selection set, a
  fragment. Always the input side; graphql-js owns the word.
- **Query** — what the ORM is told to load, in the ORM's own format (prisma
  `{ select, include, ...args }`, drizzle `DBQueryConfig`). Opaque to the walker: it hands queries
  to the adapter and returns what the adapter serializes. The `Query` type parameter everywhere.
- **Model** — the adapter's description of one table or prisma model, one object per model, so
  model identity is model equality.
- **Node** — one level of the query tree being built (a model, its columns, its relations, its
  extras). The adapter owns the shape; the walker reads only `node.model`.
- **Plan** — what a traversal collected for one root: the model it loads, the selection it starts
  from, and the merges it collected, in order. A plan holds no node. Entry points return plans; a
  nested selection makes a child plan.
- **Merge (noun)** — one entry of a plan's list: a type's selection, a variant's, a nested
  selection's relation query, or a field's, each with the query the adapter produced for it and,
  for a field, the mapping to record if it is taken (`RootMerge`).
- **Play** — to fold a plan's merges into a fresh node, in order, behind a seed selection
  (`play`). Every merge is offered to the node being built, so this is where one is accepted or
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
- **Merge (verb)** — to fold a query into a node, through the accumulator.
- **Accumulate** — what a plan's selections do: the accumulator holds the merge rules the
  adapter's translation feeds. `Adapter.accumulator`.
- **Format** — the format-specific half of a tree accumulator: how to read an ORM's query and
  how to write one back (`QueryFormat`).
- **Mapping** — what a play records for a field whose merge it took, so the field's resolver can
  find its data in the loaded row; absent means the resolver loads its own data.
- **Position** — where a field is: a link of `{ parent, type, field, node }` running back to the
  field an entry point was called for, handed to a select function and recorded with the field's
  mapping.
- **Match** — a field found at the end of an indirect-include path.
- **Enter** — to merge a type's type-level selection into a node, once, before its fields are
  walked.

## The adapter contract

An ORM plugin supplies an `Adapter<Model, Query, NodeType>`: how to find a type's model (`Model`),
what a type and a field select in the ORM's own format (`Query`), and an `Accumulator` — where
those selections accumulate. Translation and accumulation are the two halves, and the adapter
owns only the first: the traversal reads nothing of a node but its `model`, and nothing of a
query at all.

An `Accumulator<Model, Query, NodeType>` must answer three questions — `create` a node for a
model, `merge` a query into one, `emit` the node as a query. Everything else is optional and has
an answer for an accumulator that omits it: `accepts` (M-3) is true, `conflict` (S-7) is none,
and `absorb` and `acceptsFrom` round-trip through `emit`. An accumulator that gives every
consumer its own slot therefore implements three members and nothing more. `MergeOptions` says
how one merge differs from a plain one: `asQuery` (E-3, a relation query adds no columns),
`lenient` (E-2, conflicting entries are left out), `ignoreArgs` (M-3), and the `key`/`alias` the
query came from, so an accumulator may merge same-named relations into one node (prisma,
drizzle) or keep one slot per selected field.

`treeAccumulator(format)` is the accumulator the prisma and drizzle adapters use: the node tree
of `node.ts` (columns, relations, extras, arguments) with every merge rule this package owns. An
adapter supplies only a `QueryFormat` — `read`, the key loop of its own query, reported entry by
entry to an `EntryVisitor`; `serialize`, the node written back; and optionally `extraConflicts`
when its extras are not compared by value. The visitor is reused down the tree, so a merge
allocates only what the format's own key loop already allocated. An ORM whose query is not a
tree of columns, relations and extras writes its own accumulator instead.

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
package and could only be copied by round-tripping it through the accumulator on every field.

## Rule tags

Comments cite rules as `S-1`, `E-2`, `M-3`, and so on: `S` selection, `E` entry point, `M` merge,
`W` walk order, `A` async, `D` adapter-owned data, `L` loader mappings. The document that states
them is not in this repository, but nearly every rule is stated where it is defined: in the doc
comment of the function that implements it, or in the name of the test that pins it (`A-6`, `D-5`,
`L-1`, `W-1`, `W-2`, `W-3`, `W-11` live in test names). Treat a bare tag as a cross-reference to
that site. Only `A-5`, `L-4` and `L-5` are cited without being stated anywhere; write those three
down here when someone knows what they say, and this section becomes the glossary.
