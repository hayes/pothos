---
'@pothos/plugin-prisma': patch
---

A mistyped column in `t.expose*`, cursor or `prismaNode` `id.field` now lists the valid names in the error instead of a type alias. A builder without `PrismaTypes` now says to set it where a model name is given, instead of reporting the name as not assignable to `never`. Completing the model name in `prismaObjectField(s)` and `prismaInterfaceField(s)` no longer slows down with the number of models in the schema. Methods other plugins add to `PothosSchemaTypes.PrismaObjectFieldBuilder` are now available on `t` in `prismaObject`, `prismaInterface` and `prismaNode` fields, not only in `prismaObjectField(s)`. Exported refs, connection helpers and `getModel` results now compile with `declaration: true`; `PrismaRef`, `DMMFField` and `PothosPrismaDatamodelField` are exported.
