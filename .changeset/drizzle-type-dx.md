---
'@pothos/plugin-drizzle': patch
---

Type errors for a mistyped column or list relation in `t.expose*`, `t.relatedConnection` and `t.relatedCount` now list the valid names, a builder without `DrizzleRelations` says to set it, and completing table names in `drizzleObjectField(s)`, `drizzleInterfaceField(s)`, `drizzleConnection` and `drizzleConnectionHelpers` stays fast in large schemas. `DrizzleNodeRef`, `SelectionMap` and `PothosDrizzleSchemaConfig` are exported, so exported node refs, connection helpers and field factories compile with `declaration: true`. Rows loaded with `t.drizzleQueryFromInfo` can be returned from a field of the table's type, as the docs show.
