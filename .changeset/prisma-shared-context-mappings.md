---
'@pothos/plugin-prisma': patch
---

Operations or subscription events that share a context no longer resolve a filtered relation from rows loaded outside the plan, which could include rows the filter excludes. Operations sharing a context also no longer reload rows with a selection planned for another operation.
