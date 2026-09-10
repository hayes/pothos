---
'@pothos/selection-mapper': patch
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

The query builder handed to a `drizzleField` or `drizzleConnection` resolver plans the same query
a fresh walk would.

A plan is now the list of merges a walk collected, with nothing decided while it walks: the query
is built when the plan is played, against the node being built. A field that lost a conflict with
another occurrence of itself in the same document was previously dropped where it lost, so the
resolver's own selection could never bring it back even when it made the field fit; the field then
loaded on its own, costing a query the plan did not have to make. `query(select)` now produces
exactly what `queryFromInfo` produces with the same selection, in both the query and the loader
mappings.

An `async` selection function that returns while a nested selection it started is still pending is
now always reported as that, naming the field. It was previously reported, when the returned
selection held the pending promise, as a relation given a promise.
