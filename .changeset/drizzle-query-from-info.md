---
"@pothos/plugin-drizzle": minor
---

Add t.drizzleQueryFromInfo with table-aware selection and context types and async return
inference from AsyncSelections. The helper returns a query function for passing selection and
filter options directly to Drizzle, following t.drizzleField conventions. Export standalone
queryFromInfo and getSchemaConfig as a fallback, with explicit awaitSelections behavior.
