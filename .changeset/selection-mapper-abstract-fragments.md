---
'@pothos/selection-mapper': minor
---

- Plan fields in fragments on abstract types without a model (such as `... on Node` beneath a model interface) for each implementation they cover, instead of leaving them to the fallback. Fragments whose types' selections conflict are left unexpanded.
- Share planning work for repeated selection sets, so planning stays linear in the document's depth. `Position.walkParent` reads the shared walk's chain; reading `Position.parent` opts that walk out of sharing.
- `deepEqual` no longer throws on Temporal values, and compares `Map`, `Set`, `RegExp` and typed arrays correctly.
- `Plan.forParentRow` takes an options object: `forParentRow(adapter, { context, info, skipDeferredFragments, initial })`. The `Mapping` and `ParentRowOptions` types are exported.
