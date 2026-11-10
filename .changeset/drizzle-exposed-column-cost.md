---
'@pothos/plugin-drizzle': patch
---

`t.expose*` fields are cheaper to resolve, and rows returned from your own resolvers are no longer reloaded for exposed columns they already have. Reloading many rows at once is also much faster. Results are unchanged.
