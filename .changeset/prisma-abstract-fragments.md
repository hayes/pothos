---
'@pothos/plugin-prisma': patch
---

- Fields in fragments on interfaces without a model (such as `... on Node` beneath a prisma interface) are now loaded by the parent query instead of a separate query, unless the selections of the types they cover conflict with each other or with a field the parent query already loads.
- A selection set repeated at many levels of a document is planned once, so planning time grows linearly with the document's depth.
- Temporal values in query arguments no longer throw, and query arguments compare `Map`, `Set`, typed arrays and `DbNull` / `JsonNull` / `AnyNull` correctly.
- A variant whose type-level relation `select` conflicts with an interface field's `select` now returns the right data, sometimes with an extra query.
- A field that an implementation redefines (with other relation arguments, say) no longer resolves from what the interface's field loaded when the document selects it on the interface.
- A conflict between the type-level selections of two variants now reaches clients as `Unexpected error.`. The conflict is described in the error's `cause`.
