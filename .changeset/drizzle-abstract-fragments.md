---
'@pothos/plugin-drizzle': patch
---

Fields in fragments on interfaces without a table (such as `... on Node` beneath a drizzle interface) are now loaded by the parent query instead of a separate query, unless the selections of the types they cover conflict. Temporal values in query arguments no longer throw, and query arguments compare `Map`, `Set` and typed arrays correctly (a `Buffer` no longer equals a `Uint8Array`).
