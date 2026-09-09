---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

Fix how selections are found through fragments, paths and wrapper types, in both plugins.

- A path segment selected behind a fragment that narrows an interface or union (`... on Impl { field }`), or a fragment on an interface that overlaps the list type, is now found without needing to pin the type on the segment. Previously the field was skipped and the plugin fell back to a separate query per row. Drizzle crashed on a fragment spread that narrows an interface.
- When the same field is selected in several places (multiple fragments, several `paths`, or the same response key under several fragments), every selection is merged into one query. Previously `queryFromInfo` kept only the last one, and a field loaded through the fallback planned only its first occurrence.
- A relation selected under both `nodes` and `edges { node }` of a connection is answered from the loaded rows in both places. The loader mappings used to be keyed by field alias alone, so the second path fell back to a query of its own.
- A `nestedSelection` path into a field selected through a fragment on the same type (`... on Type { field }` or `...Fragment`) now merges the nested selection instead of producing an empty selection.
- Fragment spreads and inline fragments left out by `@skip` / `@include` are no longer planned, so they neither enter a variant nor add fields to the query.
- `queryFromInfo` accepts `{ name, type }` segments in `path` and `paths` alongside strings. A segment `type` pins the fragment type condition the field must be found under, which is useful when several implementations share a field name. A segment `type` that does not exist in the schema throws a validation error instead of a `TypeError`.
- When several implementations share a field name, matches whose field returns a different model or table than the one the query is being built for are ignored, so their selections are never merged into the wrong query. Variants of the target model are walked with their own fields.
- A type carrying `pothosIndirectInclude` with `paths` only contributes its own selection when it is backed by the model being queried. A plain wrapper, or a wrapper backed by another model, no longer merges its selection into the target model's query.
- `queryFromInfo` with `path`/`paths` that select nothing now returns the `select`/`include` (prisma) or `select` (drizzle) it was given, or `{}`, instead of an empty `select` (which prisma rejects) or a query that dropped the caller's selection.
- The selection lookup handed to a field's `select` callback (the fourth argument) now looks through wrappers on the field's return type and returns the first match. A `relatedConnection` with `totalCount: true` wrapped by `@pothos/plugin-errors` now selects the count, and its totalCount-only handling agrees with what was planned.
- A field `select` callback returning `false`, `null` or `undefined` is treated as selecting nothing: the field is not answered from the parent row and loads its own data when resolved.
