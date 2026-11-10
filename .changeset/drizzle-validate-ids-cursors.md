---
'@pothos/plugin-drizzle': patch
---

Validate node IDs, `t.arg.globalID({ for })` arguments and connection cursors against their column before any SQL runs. Clients have to send IDs and cursors exactly as the plugin returned them.

- Number, bigint, boolean, date, uuid, bytes and plain text columns are checked. A value of the wrong type or format fails with `Invalid ID.` or `Invalid cursor.`. These errors no longer include the input or the SQL.
- IDs such as `01`, `1e0` or `0x1` no longer load row 1. A string cursor for an integer column no longer returns the first page.
- A uuid has to be written with hyphens, like `b0000000-0000-4000-8000-000000000002`. Postgres also accepts it without hyphens or in braces, but those are now rejected.
- Compound IDs with a date that were generated before 0.19.1 now fail with `Invalid ID.`. They never found their row.
- Other values are still sent to the database, and its error is returned unchanged. This covers enums, json, custom types, array elements, network addresses, and numeric, date and time columns that are read as strings. It also covers cursor values for an `orderBy` on an `extras` expression, and values of the right type that the database rejects.
