---
'@pothos/plugin-drizzle': patch
---

Fields in a fragment on an interface with no table (`... on Node` beneath a drizzle interface) are loaded by the parent query unless the variants they cover have conflicting type-level selects. Temporal values in query arguments no longer throw. `Map`, `Set` and other instances with no enumerable state compare through their `equals`, or by identity when they have none, and typed arrays compare by type and bytes, so a `Buffer` no longer equals a `Uint8Array`.
