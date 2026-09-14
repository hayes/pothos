---
"@pothos/plugin-drizzle": minor
---

Add t.drizzleQueryFromInfo with table-aware query options and context types and async return
inference from AsyncSelections. The helper merges query options with GraphQL selections and
returns a query ready to pass directly to Drizzle. Export standalone queryFromInfo and
getSchemaConfig as a fallback, with explicit awaitSelections behavior.
