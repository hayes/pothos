---
'@pothos/plugin-prisma': minor
---

Await async `prismaNode` ID resolvers before passing their results to a custom `findUnique`.
Custom `findUnique` callbacks can now return promises. A rejected lookup fails only its own row;
synchronous lookup timing and batching are unchanged.
