# @pothos/selection-mapper

The selection-to-query walker shared by `@pothos/plugin-prisma` and `@pothos/plugin-drizzle`. It
turns the selection set a resolver receives into the ORM plugin's own query format, through
fragments, variants, directives, and indirect includes, and records the loader mappings the
plugins' field resolvers look up at resolve time.

This package is an implementation detail of those plugins. Its exports exist for them and change
with them: it is not a supported public API, and its versions carry no compatibility promise of
their own. Use the plugins.

## The adapter contract

An ORM plugin supplies an `Adapter<M, Map, X, N>`: how to find a type's model (`M`), what a type
and a field select in the ORM's own format (`Map`), a node factory (`createNode`), and how to
merge, compare and serialize a node of its own type (`N`). The walker reads nothing of a node but
its `model`, and nothing of a map at all: it hands maps to the adapter and returns what the adapter
serializes. `merge` and `compatible` receive the field key a map came from, so an adapter may
merge same-named relations into one node (prisma, drizzle) or keep one slot per selected field.
`node.ts` exports the default tree the prisma and drizzle adapters use; an ORM whose query is not a
tree of columns, relations and extras supplies its own node type instead.

Every walk records its loader mappings on the request context, which pothos requires to be an
object; an adapter whose resolvers read a loaded row another way simply never looks them up.
