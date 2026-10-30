---
'@pothos/plugin-prisma-next': minor
---

Type `isTypeOf` rows from the type's selection, accept `resolveType` on `prismaInterface` and reject `isTypeOf` there, take a to-one relation's default nullability from the contract's `nullable` flag, and reject `totalCount: true`, `t.relationCount` and `t.relationAggregate` at compile time on targets without aggregates such as MySQL.
