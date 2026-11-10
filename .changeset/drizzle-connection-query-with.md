---
'@pothos/plugin-drizzle': patch
---

`drizzleConnection` resolvers that pass `with` to `query()` now get those relations loaded on their rows; it used to be dropped.
