---
'@pothos/plugin-prisma': patch
---

Fix relatedConnection totalCount returning null when parent is loaded without _count selections (eg. when query is not spread in parent prismaField resolver)
