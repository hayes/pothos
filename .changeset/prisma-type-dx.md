---
'@pothos/plugin-prisma': patch
---

Completing the model name in `prismaObjectField(s)` and `prismaInterfaceField(s)` no longer slows down with the number of models in the schema. Methods other plugins add to `PothosSchemaTypes.PrismaObjectFieldBuilder` are now available on `t` in `prismaObject`, `prismaInterface` and `prismaNode` fields, not only in `prismaObjectField(s)`. Exported refs, connection helpers and `getModel` results now compile with `declaration: true`; `PrismaRef`, `DMMFField` and `PothosPrismaDatamodelField` are exported.
