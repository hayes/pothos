---
'@pothos/plugin-prisma': patch
---

- Fields in fragments on interfaces without a model (such as `... on Node` beneath a prisma interface) are now loaded by the parent query instead of a separate query. If the type-level selections of the types they cover conflict, the query fails, as it does for fragments that name those types. A field whose selection conflicts with them is loaded by a separate query.
- A selection set repeated at many levels of a document is planned once, so planning time grows linearly with the document's depth.
- Temporal values in query arguments no longer throw. Objects in query arguments other than plain objects, arrays and Dates (`Decimal`, `DbNull`, a `Buffer`) are compared with their `equals` method, or by identity.
- A variant whose type-level relation `select` conflicts with an interface field's `select` now returns the right data, sometimes with an extra query.
- A field that an implementation redefines (with other relation arguments, say) no longer resolves from what the interface's field loaded when the document selects it on the interface.
- A conflict between the type-level selections of two variants now reaches clients as `Unexpected error.`. The conflict is described in the error's `cause`.
