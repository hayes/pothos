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
- Prisma: under a field declared as a concrete object type, a fragment on another object type of
  the same model (which the field can never resolve as) does not merge that type's selection; it
  is still entered under an interface or union.
- In both plugins, a fragment that does not apply to the type still lets a nested fragment narrow
  back to it (drizzle previously stopped at the outer fragment).
