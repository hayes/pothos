---
'@pothos/plugin-prisma': patch
---

Speed up model name completion in `prismaObjectField(s)` and `prismaInterfaceField(s)`, list the valid names in errors for a mistyped field or cursor, and explain how to set up `PrismaTypes` when it's missing. Export the types needed to use connection helpers and refs with `declaration: true`, and make methods added to `PothosSchemaTypes.PrismaObjectFieldBuilder` work in `prismaObject`, `prismaNode` and `prismaInterface` fields (the `PrismaObjectFieldBuilder` type export is now deprecated).
