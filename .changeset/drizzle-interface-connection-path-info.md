---
'@pothos/plugin-drizzle': patch
---

Fix `pathInfo` being undefined in the `query` callback of a `t.relatedConnection` inherited from a `drizzleInterface`. The callback now gets the same `pathInfo` as when its rows were loaded, so its rows and cursors agree.
