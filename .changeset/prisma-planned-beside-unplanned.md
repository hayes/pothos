---
'@pothos/plugin-prisma': patch
---

A field on an object returned by a plain resolver no longer fails with `Cannot return null for non-nullable field` or reads an unloaded relation when another object at the same response path, reached through a fragment on a different type, was loaded with a `prismaField`'s `query`; it loads its own data instead.
