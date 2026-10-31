---
'@pothos/selection-mapper': patch
---

- Plan fields in a fragment on an abstract type with no model (`... on Node` beneath a model interface) for each implementation it covers, instead of leaving them to the fallback. If those implementations' type-level selections conflict, the fragment is left to the fallback as before.
- `deepEqual` compares values with no enumerable state (Temporal instances) through `equals`, and `Map`, `Set`, `RegExp` and Prisma's null types by identity. Typed arrays compare by type and bytes, and cyclic values no longer overflow the stack.
- `Plan.forParentRow` takes an optional `initial` selection, and the `Mapping` type is exported.
