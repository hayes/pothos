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
- **Plan** — one root being built: its query tree, the mappings recorded beneath it, and the
  adapter, context and settings the traversal runs with. Entry points return plans; a nested
  selection makes a child plan.
- **Walk** — only ever the verb: to read a selection into a plan (`walkBranches`, `walkField`,
  `walkSelections`, `walkIndirectPath`). Never a noun.
- **Branch** — one selection set (or several, for one field selected under several fragments) with
  the type to walk it as: the unit `walkBranches` takes.
- **Merge** — to fold a query into a node, through the adapter.
- **Mapping** — what a plan records for a merged field so its resolver can find its data in the
  loaded row; absent means the resolver loads its own data.
- **Position** — where a field is: a link of `{ parent, type, field, node }` running back to the
  field an entry point was called for, handed to a select function and recorded with the field's
  mapping.
- **Match** — a field found at the end of an indirect-include path.
- **Enter** — to merge a type's type-level selection into a node, once, before its fields are
  walked.

## The adapter contract

An ORM plugin supplies an `Adapter<Model, Query, NodeType>`: how to find a type's model (`Model`),
what a type and a field select in the ORM's own format (`Query`), a node factory (`createNode`),
and how to merge, compare and serialize a node of its own type (`NodeType`). The walker reads
nothing of a node but its `model`, and nothing of a query at all: it hands queries to the adapter
and returns what the adapter serializes. `merge` and `compatible` receive the field key a query
came from, so an adapter may merge same-named relations into one node (prisma, drizzle) or keep
one slot per selected field. `node.ts` exports the default tree the prisma and drizzle adapters
use; an ORM whose query is not a tree of columns, relations and extras supplies its own node type
instead.

Every select function is handed the `Position` of the field it plans: the field's node, the type
it was walked on, and a link to the position of the field the plan hangs beneath, running back to
the field an entry point was called for. The walker reads none of it — an adapter that wants a
path or a list of segments walks `parent` and materializes its own — and records it with the
field's mapping, so a resolver can ask the same question the select path asked. An adapter that
never looks at a position pays for one link per select function and no arrays.

Every plan records its loader mappings on the request context, which pothos requires to be an
object; an adapter whose resolvers read a loaded row another way simply never looks them up.

## Rule tags

Comments cite rules as `S-1`, `E-2`, `M-3`, and so on: `S` selection, `E` entry point, `M` merge,
`W` walk order, `A` async, `D` adapter-owned data, `L` loader mappings. The document that states
them is not in this repository, but nearly every rule is stated where it is defined: in the doc
comment of the function that implements it, or in the name of the test that pins it (`A-6`, `D-5`,
`L-1`, `W-1`, `W-2`, `W-3`, `W-11` live in test names). Treat a bare tag as a cross-reference to
that site. Only `A-5`, `L-4` and `L-5` are cited without being stated anywhere; write those three
down here when someone knows what they say, and this section becomes the glossary.
