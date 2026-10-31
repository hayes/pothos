---
'@pothos/plugin-prisma': patch
---

Fields in a fragment on an interface with no model (`... on Node` beneath a prisma interface) are loaded by the parent query when the variants it covers have compatible type-level selects. `DbNull`, `JsonNull` and `AnyNull` in query arguments no longer compare equal to each other, and a `Buffer` no longer equals a `Uint8Array` with the same bytes.

Importing `@pothos/plugin-prisma` after `@pothos/plugin-prisma-next` throws, since both define the same `prisma*` builder methods.
