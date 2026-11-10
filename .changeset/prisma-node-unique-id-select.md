---
'@pothos/plugin-prisma': patch
---

A `prismaNode` with a `select` whose `id.field` is a unique field or index other than the primary key now selects it. Its global IDs no longer read `Type:undefined`, and reloading its fields no longer fails.
