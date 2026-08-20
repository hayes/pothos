---
"@pothos/plugin-drizzle": patch
---

Append the primary key to connection `orderBy` when the ordering isn't already unique.

A cursor names a row's position in an ordering. If the ordering has ties — `orderBy: { createdAt: 'desc' }`, `orderBy: { status: 'asc' }` — the database is free to order the tied rows differently between queries, so paging through the connection could return a row twice or skip it entirely.

Connections already ordered by a unique, non-nullable set of columns are unchanged. Everything else gains the primary key as a trailing order column, and its cursors gain the matching values. Cursors issued before this change stay valid: they page from the columns they cover, and the cursors that page returns carry the full set.
