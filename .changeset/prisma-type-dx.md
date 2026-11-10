---
'@pothos/plugin-prisma': patch
---

Methods other plugins add to `PothosSchemaTypes.PrismaObjectFieldBuilder` are now available on `t` in `prismaObject`, `prismaInterface` and `prismaNode` fields, not only in `prismaObjectField(s)`. Exported refs, connection helpers and `getModel` results now compile with `declaration: true`; `PrismaRef`, `DMMFField` and `PothosPrismaDatamodelField` are exported.
