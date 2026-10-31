---
'@pothos/plugin-drizzle': patch
---

Fields in a fragment on an interface with no table (`... on Node` beneath a drizzle interface) are loaded by the parent query when the variants it covers have compatible type-level selects. `Map`, `Set` and `RegExp` values in query arguments compare equal only to themselves, and a `Buffer` no longer equals a `Uint8Array` with the same bytes.
