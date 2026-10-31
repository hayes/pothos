---
'@pothos/plugin-drizzle': patch
---

Fields selected in fragments on abstract types that have no table (such as `... on Node` beneath a drizzle interface) are now planned into the parent query instead of being dropped from it. If the implementations such a fragment covers have conflicting type-level selections, the query now fails with the same conflict error as selecting each implementation's fragment directly. Query arguments holding `Map`, `Set` or `RegExp` values now compare equal only to themselves when selections are merged.
