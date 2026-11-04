---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

With `ScopeAuthPlugin`, `runScopesOnType` checks now see the type's `select`/`include` data on rows the plugin didn't load, reloaded once per row and shared with the fields that reload it. As on fields, a row whose reload can't hold the relation an interface's `authScopes` read, because its implementation's `select` filters it differently, fails with an error instead of being checked against the implementation's data.
