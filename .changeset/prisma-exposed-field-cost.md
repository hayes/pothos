---
'@pothos/plugin-prisma': patch
---

`t.expose*` fields on types with a `select` are cheaper to resolve, and rows returned from your own resolvers are no longer reloaded for exposed fields they already have. Results are unchanged.
