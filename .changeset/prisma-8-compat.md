---
"@pothos/plugin-prisma": patch
"@pothos/plugin-prisma-utils": patch
---

Accept `@prisma/generator-helper` 8.x alongside 7.x, and document how Prisma 8 relates to this plugin.

Prisma 8 (`prisma@latest`) is Prisma Next, a contract-first rewrite with its own client and no `schema.prisma` generators or `@prisma/client`, so it is not something this plugin can target. Prisma ORM 7 continues to be maintained on Prisma's `v7` branch, and the plugin is verified against that branch's current builds; the dependency range is widened so a future 8.x release of the classic generator packages does not install a second copy of `@prisma/generator-helper`.
