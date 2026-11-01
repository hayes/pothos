---
'@pothos/selection-mapper': minor
---

- Plan fields in a fragment on an abstract type with no model (`... on Node` beneath a model interface) for each implementation it covers, instead of leaving them to the fallback. If those variants' type-level selections conflict with anything else in the plan, every such fragment falls back to a reload.
- `deepEqual` no longer throws on Temporal values. Instances with no enumerable state compare through their `equals`, or by identity when they have none (`Map`, `Set`, `RegExp`, Prisma's null types). Typed arrays compare by type and bytes.
- `Plan.forParentRow` takes an options object: `forParentRow(adapter, { context, info, skipDeferredFragments, initial })` replaces `forParentRow(adapter, context, info, skipDeferredFragments)`. The `Mapping` and `ParentRowOptions` types are exported.
