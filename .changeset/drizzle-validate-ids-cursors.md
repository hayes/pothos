---
'@pothos/plugin-drizzle': patch
---

Node IDs, `t.arg.globalID({ for })` arguments and connection cursors are checked against their column type before any SQL runs. Malformed values fail with `Invalid ID.` or `Invalid cursor.` and no longer echo the input or the SQL. IDs such as `01`, `1e0` or `0x1` no longer load row 1, and a string cursor for an integer column no longer returns the first page.
