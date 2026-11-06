---
'@pothos/plugin-drizzle': patch
---

Operations or subscription events that share a context no longer resolve a filtered relation from rows loaded outside the plan, which could include rows the filter excludes.
