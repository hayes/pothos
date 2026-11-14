---
'@pothos/core': minor
'@pothos/plugin-drizzle': patch
'@pothos/plugin-prisma': patch
'@pothos/plugin-prisma-next': patch
---

Add a `clone()` method to field builders and use it for `withAuth` so ORM field builders keep their type-specific state.
