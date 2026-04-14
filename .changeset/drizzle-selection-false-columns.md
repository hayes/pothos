---
"@pothos/plugin-drizzle": patch
---

Fix column selection merging to respect `false` values. Columns explicitly set to `false` in a selection are no longer added to the query.
