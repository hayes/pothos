---
'@pothos/plugin-prisma': patch
---

Fields in fragments on interfaces without a model (such as `... on Node` beneath a prisma interface) are now loaded by the parent query instead of a separate query, unless the selections of the types they cover conflict. Temporal values in query arguments no longer throw, and query arguments compare `Map`, `Set`, typed arrays and `DbNull` / `JsonNull` / `AnyNull` correctly.
