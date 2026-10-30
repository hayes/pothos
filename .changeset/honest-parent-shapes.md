---
'@pothos/plugin-prisma-next': minor
---

Correct the public field types, and let more fields return what they declare.

- `t.variant`'s `isNull` parent now only has the columns in `select`.
- `authScopes`, `totalCount` and similar callbacks on relations, connections, aggregates and
  `t.expose*` now see the columns declared by the type's `select`, plus the exposed column.
- `t.prismaField` and `t.prismaConnection` accept `prismaInterface` refs, and a bare `t.relation` to
  a model registered only as an interface resolves to that interface.
- A nullable `t.prismaConnection` can return `null`.
- Bytes columns are rejected as cursor columns, by type and when the schema is built.
