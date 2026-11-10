---
'@pothos/plugin-prisma': patch
---

`t.expose*` fields on types with a `select` are faster, and rows returned by your own resolvers are no longer reloaded for exposed fields they already have. Those fields now use the row's values, as they already did for rows the plugin loaded.
