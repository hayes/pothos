---
'@pothos/plugin-drizzle': patch
---

`node(id:)` for a row that does not exist now returns `null` instead of an error. In `nodes(ids:)`, a missing row or an invalid ID now only makes its own entry `null` instead of failing the whole field.
