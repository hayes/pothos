---
'@pothos/plugin-prisma': patch
---

Fields in a fragment on an interface with no model (`... on Node` beneath a prisma interface) are loaded by the parent query unless the variants they cover have conflicting type-level selects. Temporal values in query arguments no longer throw. `Map`, `Set` and instances with no enumerable state compare by identity, and typed arrays compare by type and bytes, so a `Buffer` no longer equals a `Uint8Array`. `DbNull`, `JsonNull` and `AnyNull` no longer equal each other.
