---
'@pothos/core': minor
'@pothos/plugin-drizzle': patch
'@pothos/plugin-prisma': patch
'@pothos/plugin-prisma-next': patch
---

Add `extendFieldBuilder` for plugins that derive field builders, such as `withAuth`. ORM field builders now keep their type-specific state through `withAuth`. Upgrade these packages together with `@pothos/plugin-scope-auth`.
