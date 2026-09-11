---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

The prisma and drizzle plugins now plan their queries with one shared selection planner, the new
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
