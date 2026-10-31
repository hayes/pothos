---
'@pothos/plugin-drizzle': patch
---

Fields selected in fragments on abstract types that have no table (such as `... on Node` beneath a drizzle interface) are now planned into the parent query instead of being dropped from it. If the implementations such a fragment covers have conflicting type-level selections, the query now fails with the same conflict error as selecting each implementation's fragment directly. A fragment like this that selects no fields of its own only narrows the fragments nested in it: they apply to the implementations the outer fragment covers, never to ones it excludes. Query arguments holding `Map`, `Set` or `RegExp` values now compare equal only to themselves when selections are merged. Typed arrays in query arguments now compare by type as well as bytes, so a `Buffer` and a `Uint8Array` holding the same bytes are no longer merged.
