---
'@pothos/plugin-prisma': patch
---

On graphql 17 and `@graphql-tools/executor` (Yoga), a field reloaded for a subscription event now runs its `select` and `query` callbacks for that event, instead of reusing what they returned for the first event.
