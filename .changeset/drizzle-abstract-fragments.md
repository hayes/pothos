---
'@pothos/plugin-drizzle': patch
---

- Fields in fragments on interfaces without a table (such as `... on Node` beneath a drizzle interface) are now loaded by the parent query instead of a separate query. If the type-level selections of the types they cover conflict, the query fails, as it does for fragments that name those types. A field whose selection conflicts with them is loaded by a separate query.
- A selection set repeated at many levels of a document is planned once, so planning time grows linearly with the document's depth. A field `select` or relation `query` that reads its path is still planned at each place it appears. Beneath a fragment on an interface without a table, a field the implementations inherit from the drizzle interface is planned once, with a path that names that interface.
- Temporal values in query arguments no longer throw. Objects in query arguments other than plain objects, arrays and Dates (a `Buffer`, a typed array) are compared with their `equals` method, or by identity.
- A variant whose type-level relation `select` conflicts with an interface field's `select` now returns the right data, sometimes with an extra query.
- A field that an implementation redefines (with other relation arguments, say) no longer resolves from what the interface's field loaded when the document selects it on the interface.
- When a type implements two drizzle interfaces that both define a field, a document selecting that field through the interface the type does not inherit it from now loads it with an extra query.
- A conflict between the type-level selections of two variants now reaches clients as `Unexpected error.`. The conflict is described in the error's `cause`.
