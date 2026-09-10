---
'@pothos/plugin-drizzle': patch
---

Two fixes, matching the prisma plugin.

- A connection asked for `last: 0` pages backwards, as any other `last` does. `0` was read as "no
  `last` given", so the query took rows forwards and `pageInfo` came back as though the request had
  been a forward page: `hasNextPage` true and `hasPreviousPage` false on a non-empty connection.
- `builder.drizzleNode` with an `id.column` that is not the table's primary key now loads. The id
  was parsed back into a record keyed by the database column name while the serializer read, and
  the model loader looked up, the column's typescript name, so a node whose id column is named
  differently in the database (`user_id` for `userId`) threw `Primary key column ... not found`.
  The loaded rows were then matched back to the ids they were loaded for by primary key, which
  such a record does not carry, so a node keyed by any other unique column reported "not found".
