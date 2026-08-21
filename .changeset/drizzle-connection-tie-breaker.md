---
"@pothos/plugin-drizzle": patch
---

Add the primary key to connection `orderBy` when the ordering is not already unique.

A cursor records a row's position in an ordering. When that ordering is not unique, `orderBy: { createdAt: 'desc' }` for example, rows sharing a value can be returned in a different order on each query, so paging through the connection may return a row twice, or skip it.

Connections ordered by a unique set of non-nullable columns are unchanged. Other connections get the primary key as a trailing order column, and their cursors include the matching values. Cursors created before this change still work: they page from the columns they contain, and the cursors returned by that page contain the full set.
