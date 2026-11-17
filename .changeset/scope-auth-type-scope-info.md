---
'@pothos/plugin-scope-auth': minor
---

Pass type `authScopes` and `grantScopes` functions an `info` object with `parentType` (the object type being checked) and `schema`, and add `isParentType(ref, parent, info)` to narrow the parent to a type's shape. Interface scopes, such as a policy on the Relay `Node` interface, can now apply different rules to each implementing type.
