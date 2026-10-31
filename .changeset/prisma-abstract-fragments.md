---
'@pothos/plugin-prisma': patch
---

Fields selected in fragments on abstract types that have no model (such as `... on Node` beneath a prisma interface) are now planned into the parent query instead of being dropped from it. If the implementations such a fragment covers have conflicting type-level selections, the query now fails with the same conflict error as selecting each implementation's fragment directly. `DbNull`, `JsonNull` and `AnyNull` in query arguments are no longer treated as equal to each other when selections are merged.
