---
"@pothos/plugin-prisma-utils": patch
---

- Omit `prismaOrderBy` fields set to `false`. If no fields remain, the resulting empty input type
  fails schema validation and queries. Omit the `prismaOrderBy` call when no fields are enabled.
- Default scalar `prismaOrderBy` field callbacks without a `type` to the order enum.
- Type `prismaListFilter` operations as optional and infer operation names from `as const` tuples.
