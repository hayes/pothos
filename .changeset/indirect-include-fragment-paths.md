---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

Fix resolution of indirect include paths that pass through fragments.

- A path segment selected behind a fragment that narrows an interface or union (`... on Impl { field }`) is now found without needing to pin the type on the segment. Previously the field was skipped and the plugin fell back to a separate query per row.
- A `nestedSelection` path into a field selected through a fragment on the same type (`... on Type { field }` or `...Fragment`) now merges the nested selection instead of producing an empty selection.
- `queryFromInfo` now accepts `{ name, type }` segments in `path` and `paths` alongside strings, matching what the runtime already supported. A segment `type` pins the fragment type condition the field must be found under, which is useful when several implementations share a field name.
