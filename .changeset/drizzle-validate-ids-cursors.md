---
'@pothos/plugin-drizzle': patch
---

Node IDs, `t.arg.globalID({ for })` arguments and connection cursors are checked against their column before any SQL runs, for number, bigint, boolean, date, uuid, bytes and plain text columns. A value of the wrong type or form fails with `Invalid ID.` or `Invalid cursor.`, which no longer echo the input or the SQL. IDs such as `01`, `1e0` or `0x1` no longer load row 1, and a string cursor for an integer column no longer returns the first page. Compound IDs written before 0.19.1 that hold a date never found their row and now fail with `Invalid ID.`.

IDs and cursors have to be in the form the plugin writes. A uuid, for example, is `b0000000-0000-4000-8000-000000000002`: Postgres also reads it without hyphens or in braces, and those spellings are now refused.

Values for other columns (enums, json, custom types, the elements of an array, numeric, date and time strings, network addresses), for an ordering by an `extras` expression, and values of the right type that the database refuses still reach the database, and its error passes through unchanged.
