---
'@pothos/plugin-drizzle': patch
---

Fix `drizzleConnection` resolvers dropping `with` passed to `query()`. Those relations are now loaded on the rows.
