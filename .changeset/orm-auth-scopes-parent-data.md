---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

A parent row missing the data of a field's `select` or its type's `select`/`include` is now reloaded before `authScopes` run, so plugins listed before this one see the data their types promise.
