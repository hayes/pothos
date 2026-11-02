---
'@pothos/selection-mapper': minor
---

- Plan fields in a fragment on an abstract type with no model (`... on Node` beneath a model interface), or of another model, for each implementation it covers, instead of leaving them to the fallback. The parent query then carries those variants' type-level selects, and a variant with no type-level select widens it to the whole row. Every such fragment is left unexpanded if those selects conflict with each other, with another variant the document enters, or with the initial selection, or if one of them conflicts with a field-level select elsewhere in the query. A field with a select of its own then loads separately, and a field with none reads the row as loaded, so a column only the variant's type-level select would have loaded is `undefined`, with no error.
- `deepEqual` no longer throws on Temporal values. Instances with no enumerable state compare through their `equals`, or by identity when they have none (`Map`, `Set`, `RegExp`, Prisma's null types). Typed arrays compare by type and bytes.
- `Plan.forParentRow` takes an options object: `forParentRow(adapter, { context, info, skipDeferredFragments, initial })` replaces `forParentRow(adapter, context, info, skipDeferredFragments)`. The `Mapping` and `ParentRowOptions` types are exported.
