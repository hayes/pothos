---
'@pothos/plugin-drizzle': patch
---

A `t.relatedConnection` inherited from a `drizzleInterface` now passes its `query` callback the same `pathInfo` it was planned with, so its rows and cursors agree. It used to receive `undefined` when resolving.
