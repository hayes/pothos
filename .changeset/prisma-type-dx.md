---
'@pothos/plugin-prisma': patch
---

Type errors for a mistyped column, cursor or model name now list the valid names, a builder without `PrismaTypes` says to set it, and completing model names in `prismaObjectField(s)` and `prismaInterfaceField(s)` stays fast in large schemas. `t` in `prismaObject`, `prismaInterface` and `prismaNode` fields now has the methods other plugins add to `PothosSchemaTypes.PrismaObjectFieldBuilder`, and `PrismaRef`, `DMMFField` and `PothosPrismaDatamodelField` are exported, so exported refs and connection helpers compile with `declaration: true`.
