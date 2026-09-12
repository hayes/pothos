---
"@pothos/plugin-prisma-utils": patch
---

- `prismaOrderBy` no longer creates a field for entries explicitly set to `false`
- `prismaOrderBy` scalar field callbacks that omit `type` now default to the order enum instead of failing schema construction
- `prismaListFilter` now types its operations as optional (and infers op names from `as const` tuples), matching the optional fields it creates at runtime
