---
'@pothos/selection-mapper': minor
---

- Fields in a fragment on an abstract type without a model (such as `... on Node` beneath a model interface) are now planned for each type the fragment covers, so the parent query loads them. If those types' selections conflict, the fragment is left to the fallback.
- Repeated selection sets are planned once and shared, so planning time grows linearly with the document's depth. Reading `Position.parent` turns off sharing for that walk. Use `Position.walkParent` to read the shared walk's parents instead.
- `deepEqual` no longer throws on Temporal values, and compares `Map`, `Set`, `RegExp` and typed arrays correctly.
- `Plan.forParentRow` takes an options object: `forParentRow(adapter, { context, info, skipDeferredFragments, initial })`. The `Mapping` and `ParentRowOptions` types are exported.
