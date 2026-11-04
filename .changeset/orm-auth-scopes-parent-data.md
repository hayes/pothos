---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

When scope-auth is installed, for rows the plugin didn't load, the type's `select`/`include` data (and that of the interfaces it implements) is now loaded before `authScopes` run. A field's own `select` is still loaded after them, for its resolver. An interface whose `authScopes` would read a relation its implementation's `select` filters differently now fails that reload with an error instead of being checked against the implementation's data.
