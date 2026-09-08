---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

Fix resolution of indirect include paths that pass through fragments.

- A path segment selected behind a fragment that narrows an interface or union (`... on Impl { field }`), or a fragment on an interface that overlaps the list type, is now found without needing to pin the type on the segment. Previously the field was skipped and the plugin fell back to a separate query per row.
- When the same segment is selected in several places (multiple fragments, or several `paths`), every selection is now merged into one query. Previously `queryFromInfo` only kept the last one.
- A `nestedSelection` path into a field selected through a fragment on the same type (`... on Type { field }` or `...Fragment`) now merges the nested selection instead of producing an empty selection.
- `queryFromInfo` now accepts `{ name, type }` segments in `path` and `paths` alongside strings, matching what the runtime already supported. A segment `type` pins the fragment type condition the field must be found under, which is useful when several implementations share a field name.
- When several implementations share a field name, matches whose field returns a different model or table than the one the query is being built for are ignored, so their selections are never merged into the wrong query. Variants of the target model are walked with their own fields.
- A segment `type` that does not exist in the schema now throws a validation error instead of a `TypeError`.
