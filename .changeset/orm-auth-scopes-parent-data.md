---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

When scope-auth is installed, for rows the plugin didn't load, the type's `select`/`include` data (and that of the interfaces it implements) is now loaded before `authScopes` run. A field's own `select` is still loaded after them, for its resolver.
