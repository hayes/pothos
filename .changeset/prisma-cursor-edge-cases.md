---
'@pothos/plugin-prisma': patch
---

Two cursor fixes.

- A connection asked for `last: 0` pages backwards, as any other `last` does. `0` was read as
  "no `last` given", so the query took rows forwards and `pageInfo` came back as though the
  request had been a forward page: `hasNextPage` true and `hasPreviousPage` false on a
  non-empty connection.
- A compound cursor carrying the wrong number of values is rejected with a validation error
  naming both counts, rather than building a query with a missing key (or silently dropping an
  extra one) for prisma to reject. The drizzle plugin already checked this.
