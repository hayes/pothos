---
'@pothos/plugin-drizzle': patch
---

Fixes for tables whose columns are named differently in the database, and two cursor fixes.

- `t.relatedCount` and a `t.relatedConnection`'s `totalCount` read the relation's source column off
  the parent by its database name. A table declaring `postId: integer('id')` carries it as `postId`,
  so the count bound `undefined` and the driver rejected the query with "undefined cannot be passed
  as argument to the database". The column is now read by its typescript name, as every other read
  of a row is.
- `builder.drizzleNode` with an `id.column` that is not the table's primary key now loads. The id
  was parsed back into a record keyed by the database column name, while the serializer wrote, and
  the model loader reads, the typescript name. The loaded rows were then matched back to the ids
  they were loaded for by primary key, which such a record does not carry.
- A node id built from a date column parses back to that date. `new Date` was given the epoch
  milliseconds the serializer writes as a string, which is not a format it parses, so every such id
  resolved as an Invalid Date.
- A connection asked for `last: 0` pages backwards, as any other `last` does. `0` was read as "no
  `last` given", so the query took rows forwards and `pageInfo` came back as though the request had
  been a forward page: `hasNextPage` true and `hasPreviousPage` false on a non-empty connection.
- A cursor value on a real or float column round trips. It was read back with `parseInt`, which
  truncates `1.75` to `1` and reads a large number's `1e+21` as `1`, so the page resumed from the
  wrong row.
