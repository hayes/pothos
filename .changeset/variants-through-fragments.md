---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

Entering another type of the same model through a fragment (a variant under a model interface or union) now merges that type's type-level selection, so resolvers relying on it find their data in the same query. This can change the shape of queries a schema with variants issues, and it adds one validation error.

- A variant without a type-level `select` switches the query to include mode (prisma) or every
  column (drizzle).
- If the two types' type-level selections disagree on a relation's arguments, a validation error
  names both types and the relation; move the relation arguments to a field-level `select` on one
  of the types. Relation arguments are compared structurally, so equal arguments written
  separately are fine. In drizzle, two types defining the same `extras` key with different
  functions are rejected the same way, naming the extra: an extra shared across variants must be
  the same function reference.
- The type-level selections of every variant entered at a selection set are merged before the
  fields there are planned, so the result no longer depends on document order: a field-level
  `select` whose relation arguments conflict with a variant's type-level selection falls back to
  its own query whichever comes first, and only two type-level selections can conflict.
- A walk on an object type is a walk on rows of that type: the field's own type, the `typeName`
  given to `queryFromInfo`, the type pinned by `nestedSelection`, or a node load. A fragment on
  another object type of the same model cannot apply to those rows, so it is not entered; it is
  entered while walking an interface, where rows may resolve to it. Prisma previously entered it
  whenever the field's declared type was abstract, planning a sibling variant's selection for
  rows that could never be it.
- In both plugins, a fragment that does not apply to the type still lets a nested fragment narrow
  back to it (drizzle previously stopped at the outer fragment).
