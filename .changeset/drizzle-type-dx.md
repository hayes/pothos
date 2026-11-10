---
'@pothos/plugin-drizzle': patch
---

Speed up table name completion in `drizzleObjectField(s)`, `drizzleInterfaceField(s)` and `t.drizzleConnection`, list the valid names in errors for a mistyped column or relation, and explain how to set up `DrizzleRelations` when it's missing. Export the types needed to use node refs and connection helpers with `declaration: true`, and allow returning rows loaded with `t.drizzleQueryFromInfo` from a field of the table's type.
