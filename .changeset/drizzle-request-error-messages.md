---
'@pothos/plugin-drizzle': patch
---

Request-time errors caused by schema mistakes (an unknown relation in a field or connection `select`, an `orderBy` naming neither a column nor an extra, a row returned without its key columns, a table without a primary key where one is needed, a parent row that no longer exists) now show clients `Unexpected error.`, with the detail in the error's `cause`. An unknown relation in a type-level `select` of `drizzleObject`, `drizzleNode` or `drizzleInterface` is reported when the schema is built, as is a `drizzleNode` whose single ID column cannot hold an ID (boolean, bytes, geometry or array columns).
