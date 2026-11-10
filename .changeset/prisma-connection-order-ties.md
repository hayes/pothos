---
'@pothos/plugin-prisma': patch
---

Fix `relatedConnection` and `prismaConnectionHelpers` pages when `orderBy` is not unique

- When `orderBy` is not unique, the plugin now sorts by the cursor's fields last, in the direction of the last `orderBy` entry. Pages read backward with `last` match the pages read forward.
- Forward pages change too. Rows that tie on `orderBy` used to come back in whatever order the database chose, and now come back in cursor order.
- To choose the order of tied rows yourself, end `orderBy` with a unique, non-null column. An `orderBy` that is absent or already unique is not changed.
- With a non-unique `orderBy`, pages after a cursor are paged in SQL instead of in memory, which is much faster for most pages. An index that ends with the cursor key (for example `(authorId, postId, id)`) keeps them fast.
- A cursor issued before upgrading continues in the new order, so a client paging through tied rows during the upgrade can see a row twice or miss one.
- When `orderBy` is not unique, a connection helper's `getQuery` now returns `orderBy` as an array, and its type is `OrderBy | OrderBy[]`. Code that reads it as a single object (for example `getQuery(...).orderBy?.createdAt`) no longer compiles and needs to handle both. The helper's `query` option also accepts a list for `orderBy`.
- `first` together with `last` now pages forward by `first`, as `@pothos/core` does.
