---
'@pothos/plugin-prisma': patch
---

Completing model names in `prismaObjectField(s)` and `prismaInterfaceField(s)` is faster in large schemas, and exported connection helpers and refs now compile with `declaration: true`. Type errors for a mistyped column or cursor name now list the valid names, and a model name given to a builder without `PrismaTypes` says how to set it. Methods added to `PothosSchemaTypes.PrismaObjectFieldBuilder` are now available in `prismaObject`, `prismaNode` and `prismaInterface` fields, and the exported `PrismaObjectFieldBuilder` type alias is deprecated.
