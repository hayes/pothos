---
'@pothos/plugin-drizzle': patch
---

Treat `undefined` query properties as absent when building Drizzle queries. Query callbacks that return a conditional filter (e.g. `where: cond ? filter : undefined`) previously produced a selection that compared as incompatible with an equivalent selection that omitted the key, causing the field's selection to be dropped. `where`, `orderBy`, `limit`, and `offset` are now normalized before selections are stored, compared, or passed to Drizzle.
