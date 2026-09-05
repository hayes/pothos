---
'@pothos/plugin-drizzle': patch
---

Plan fragments on interfaces implemented by a Drizzle object against the object, so `select` declared on the interface's fields is merged into the query instead of being skipped and loaded separately. Export `DrizzleInterfaceRef` and the `DrizzleRef` type from the package index.
