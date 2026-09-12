---
"@pothos/plugin-drizzle": patch
---

Preserve bigint and Date values in compound node IDs, which previously threw or came back as a string

Parse numeric node IDs with `Number` rather than `parseInt`, so a non-integer ID no longer truncates
