---
'@pothos/plugin-prisma': minor
---

Fix type issue where using `select` on a type or field for a nullable relation would result in the
relation being non-nullable on the parent object
