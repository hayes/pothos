---
"@pothos/plugin-prisma-utils": patch
---

- `prismaOrderBy` no longer creates a field for entries explicitly set to `false`.

  Behaviour change: if _every_ entry is `false` (or `fields` is empty), the resulting
  input object now has no fields. `builder.toSchema()` still succeeds, but the schema
  is invalid — `validateSchema()` reports `Input Object type <Name>OrderBy must define
  one or more fields.` and every query fails with that error. Previously an all-`false`
  `fields` map produced a working order-by input. Omit the `prismaOrderBy` call
  entirely when no fields are enabled.

- `prismaOrderBy` scalar field callbacks that omit `type` now default to the order enum instead of failing schema construction
- `prismaListFilter` now types its operations as optional (and infers op names from `as const` tuples), matching the optional fields it creates at runtime
