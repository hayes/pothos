---
'@pothos/plugin-drizzle': patch
---

Completing a table name in `drizzleObjectField(s)`, `drizzleInterfaceField(s)`, `t.drizzleConnection` and `drizzleConnectionHelpers` is faster in large schemas, errors for a mistyped column or relation in `t.expose*`, `t.relatedConnection` and `t.relatedCount` list the valid names, and a builder without `DrizzleRelations` says to set it. Exported node refs, connection helpers and field factories compile with `declaration: true`. Rows loaded with `t.drizzleQueryFromInfo` can be returned from a field of the table's type, as the docs show, with or without other query options.
