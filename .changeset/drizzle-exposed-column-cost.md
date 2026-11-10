---
'@pothos/plugin-drizzle': patch
---

`t.expose*` fields are faster, and rows returned by your own resolvers are no longer reloaded for exposed columns they already have. Those fields now use the row's values, as they already did for rows the plugin loaded. If you use scope-auth, auth checks that read those columns now see the row's values too, instead of freshly loaded ones. Reloading many rows at once is also much faster.
