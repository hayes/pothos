---
'@pothos/selection-mapper': minor
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

The prisma and drizzle plugins now plan their queries with one shared selection planner, the new
package `@pothos/selection-mapper`. Each plugin keeps its own adapter for its query format; the
walk from a GraphQL selection to a query is the same code in both. The adapter contract is generic
over the ORM's query format and its query-tree node: the walker reads nothing of either, so an ORM
whose query is a builder rather than a map, or that keeps one slot per selected field rather than
merging same-named relations, fits without a shared node shape.

The package is an implementation detail of the two plugins. Its exports exist for them and change
with them: it is not a supported public API, and its versions carry no compatibility promise of
their own. What it exposes is the `Plan` class (`Plan.fromInfo` for the field a resolver was called
for, `Plan.forParentRow` for the row a field is loaded for), the `Adapter` and `NodeAdapter` classes
an ORM plugin subclasses, and the loader-map, field-name and equality helpers those adapters call.

The plugins' public API is unchanged: only internal helpers moved (each plugin's `map-query`,
`selections`, `loader-map` and `deep-equal`), and the loader mapping keys (internal) now carry the
full field path. Behaviour that differed between the two plugins for no reason now agrees. In
particular, prisma walks fragments the way drizzle did: fields under a fragment on an interface the
type implements, including interfaces not backed by a model, are planned for the type instead of
falling back to a query per row.

The other entries in this release describe what changes for a schema; they are grouped by topic
rather than by plugin where both are affected.
