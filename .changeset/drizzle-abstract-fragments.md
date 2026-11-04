---
'@pothos/plugin-drizzle': patch
---

- Fields in fragments on interfaces without a table (such as `... on Node` beneath a drizzle interface) are now loaded by the parent query instead of a separate query, unless the selections of the types they cover conflict with each other or with a field the parent query already loads.
- A selection set repeated at many levels of a document is planned once, so planning time grows linearly with the document's depth. A field `select` or relation `query` that reads its path is still planned once at each place it appears. Beneath a fragment on an interface without a table, its path names the type the document selects the field on.
- Temporal values in query arguments no longer throw, and query arguments compare `Map`, `Set` and typed arrays correctly (a `Buffer` no longer equals a `Uint8Array`).
- A variant whose type-level relation `select` conflicts with an interface field's `select` now returns the right data, sometimes with an extra query.
- A field that an implementation redefines (with other relation arguments, say) no longer resolves from what the interface's field loaded when the document selects it on the interface.
