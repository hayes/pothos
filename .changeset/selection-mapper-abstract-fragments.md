---
'@pothos/selection-mapper': patch
---

- Plan fields in a fragment on an abstract type with no model (`... on Node` beneath a model interface) for each implementation it covers, instead of leaving them to the fallback. If the type-level selections such fragments enter conflict with each other, with another variant the document enters, or with the initial selection, every such fragment in that plan falls back as before.
- `deepEqual` no longer throws a TypeError on Temporal values: instances with no enumerable state are compared through their `equals`, or by identity when they have none (`Map`, `Set`, `RegExp`, Prisma's null types). Typed arrays compare by type and bytes.
- `Plan.forParentRow` takes an options object (`context`, `info`, `skipDeferredFragments`, `initial`), and the `Mapping` type is exported.
