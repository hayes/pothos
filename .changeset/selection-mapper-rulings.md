---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

Fix several cases where the selection planner produced a query that did not match what resolvers rely on.

- When a field falls back to the model loader (its data is missing from the parent row), the loaded row now also carries the parent type's type-level `select`/`include` (prisma) or type-level columns, relations and extras (drizzle), since that row replaces the parent the resolver sees. The field's own selection always wins: a type-level relation whose arguments conflict with it is left out of that query.
- Prisma now walks fragments the way the drizzle plugin does: fields under a fragment on an interface the type implements (including interfaces not backed by a model) are planned for the type instead of falling back to a query per row, and a fragment that does not apply to the type still lets a nested fragment narrow back to it.
- Entering a different type of the same model through a fragment (a variant under a model interface) now merges that type's type-level selection, so resolvers relying on it find their data in the same query. A variant without a type-level `select` switches the query to include mode (prisma) or every column (drizzle). If the two types' type-level selections disagree on a relation's arguments, a validation error names both types and the relation; move the relation arguments to a field-level `select` on one of the types.
- A type carrying `pothosIndirectInclude` with `paths` only contributes its own selection when it is backed by the model being queried. A plain wrapper, or a wrapper backed by another model, no longer merges its selection into the target model's query.
- `queryFromInfo` with `path`/`paths` that select nothing now returns the `select`/`include` (prisma) or `select` (drizzle) it was given, or `{}`, instead of an empty `select` (which prisma rejects) or a query that dropped the caller's selection.
- The selection lookup handed to a field's `select` callback (the fourth argument) now looks through wrappers on the field's return type and returns the first match. A `relatedConnection` with `totalCount: true` wrapped by `@pothos/plugin-errors` now selects the count, and its totalCount-only handling agrees with what was planned.
- A field `select` callback returning `false`, `null` or `undefined` is treated as selecting nothing: the field is not answered from the parent row and loads its own data when resolved.
- (drizzle) `pathInfo.path` handed to relation `query` callbacks now starts with the root field for queries planned through `path`/`paths`, as it already did for queries planned directly for a field.
