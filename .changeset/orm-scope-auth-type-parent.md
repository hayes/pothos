---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

With `ScopeAuthPlugin`, `runScopesOnType` checks now see the type's `select`/`include` data on rows the plugin didn't load, reloaded once per row and shared with the fields that reload it.
