---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

When a field falls back to the model loader (its data is missing from the parent row), the loaded row now also carries the parent type's type-level `select`/`include` (prisma) or type-level columns, relations and extras (drizzle), since that row replaces the parent the resolver sees. Fallback queries therefore load more than before: the parent type's own columns and its type-level relations.

- The field's own selection always wins: a type-level relation whose arguments conflict with it is
  left out of that query.
- Prisma: when a type-level `_count` has several counts and one conflicts with the count a field
  selects for itself, the loader keeps the other counts instead of dropping `_count` altogether.
