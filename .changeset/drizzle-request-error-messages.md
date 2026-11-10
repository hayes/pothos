---
'@pothos/plugin-drizzle': patch
---

Request-time errors caused by schema mistakes (an unknown relation in a field or connection `select`, an `orderBy` naming neither a column nor an extra, a row returned without its key columns, a table without a primary key where one is needed, a parent row that no longer exists) now show clients `Unexpected error.`, with the detail in the error's `cause`.

An unknown relation in the type-level `select` of a `drizzleObject` or `drizzleNode` already failed when the type was defined; it is now a `PothosSchemaError` that names the type. The same mistake in a `drizzleInterface` now fails there too. Such a schema used to build, and only fields returning the interface failed, so it has to be fixed before upgrading. A `drizzleNode` whose single ID column cannot hold an ID (boolean, bytes, geometry or array columns) also fails when it is defined, instead of on every request.
