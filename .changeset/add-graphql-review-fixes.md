---
"@pothos/plugin-add-graphql": patch
---

Use the operation root roles of an imported schema instead of inferring them from type names: roots with custom names are now imported as roots, non-root types named `Query`, `Mutation` or `Subscription` are no longer promoted to roots, and an operation root the builder already defines is never re-declared. Also preserve `deprecationReason` on imported input object fields
