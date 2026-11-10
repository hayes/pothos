---
'@pothos/plugin-prisma': patch
---

On graphql 17 and `@graphql-tools/executor` (Yoga), a field reloaded for a subscription event now runs its `select` and `query` callbacks for that event, instead of reusing what they returned for the first event. A field reloaded beneath two root fields of one mutation is planned for each, so a `select` or `query` that reads context sees what the earlier root field changed.
