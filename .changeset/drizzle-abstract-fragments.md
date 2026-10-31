---
'@pothos/plugin-drizzle': patch
---

Fields in a fragment on an interface with no table (`... on Node` beneath a drizzle interface) are loaded by the parent query when the type-level selects of the variants such fragments cover are compatible. Query arguments holding Temporal values no longer throw while planning, and class instances with no enumerable state (such as `Map` and `Set`) and typed arrays are no longer mistaken for equal, so a `Buffer` no longer equals a `Uint8Array` with the same bytes.
