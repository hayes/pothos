---
'@pothos/plugin-drizzle': patch
---

A field on a row a `drizzleField` returned without its `query` no longer reads a relation that was never loaded when another row at the same response path, reached through a fragment on a different type, was loaded with the `query`; it reloads the row instead.
