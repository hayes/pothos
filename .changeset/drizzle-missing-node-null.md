---
'@pothos/plugin-drizzle': patch
---

`node(id:)` for a row that does not exist now returns `null` instead of an error, and a missing or malformed ID in `nodes(ids:)` makes only its own entry `null` instead of failing the whole field.
