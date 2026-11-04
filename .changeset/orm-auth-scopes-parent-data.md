---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

For rows the plugin didn't load, a field's `select` and its type's `select`/`include` data are now loaded before `authScopes` run.
