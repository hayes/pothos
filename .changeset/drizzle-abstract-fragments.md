---
'@pothos/plugin-drizzle': patch
---

- Fields in fragments on interfaces without a table (such as `... on Node` beneath a drizzle interface) are now loaded by the parent query instead of a separate query, unless the selections of the types they cover conflict with each other or with a field the parent query already loads.
- A selection set repeated at many levels of a document is planned once, so planning time grows linearly with the document's depth. A field `select` or relation `query` that reads its path is still planned at each place it appears.
- Temporal values in query arguments no longer throw, and query arguments compare `Map`, `Set` and typed arrays correctly (a `Buffer` no longer equals a `Uint8Array`).
- A variant whose type-level relation `select` conflicts with an interface field's `select` can cost extra queries, where it returned wrong data before.
