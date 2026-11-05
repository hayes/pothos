---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

With scope-auth, checks that read the parent now see what the type's `select` (or prisma `include`) loads, even for a row returned from a plain `t.field`. Resolvers still get the original row.
