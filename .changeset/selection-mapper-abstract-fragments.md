---
'@pothos/selection-mapper': patch
---

- Plan fields in fragments on abstract types that have no model (such as `... on Node` beneath a model interface) instead of dropping them. The fields are walked as each implementation of the queried model that the fragment covers. A fragment that selects fields this way also enters those implementations' type-level selections, so implementations whose type-level selections conflict now raise the same conflict error as selecting each implementation's fragment directly, where their fields used to be dropped silently. A variant fragment nested in such a fragment (`... on Node { ... on Feature { … } }`) is entered just as it is without the wrapper.
- Object types accept fragments on unions that contain them.
- `deepEqual` compares values with no enumerable state (such as Temporal instances) through `equals`, and only when both sides share a prototype. Other values without enumerable state (`Map`, `Set`, `RegExp`, Prisma's `DbNull`/`JsonNull`/`AnyNull`) are equal only to themselves, where any two of a kind used to compare equal. Typed arrays compare by type and bytes, and cyclic values no longer overflow the stack.
- `Plan.forParentRow` takes an optional `initial` selection, and the `Mapping` type is exported.
