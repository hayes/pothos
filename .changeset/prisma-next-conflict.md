---
'@pothos/plugin-prisma': patch
---

Importing `@pothos/plugin-prisma` after `@pothos/plugin-prisma-next` throws, since both define the same `prisma*` builder methods.
