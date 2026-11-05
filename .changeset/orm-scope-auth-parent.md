---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

With scope-auth 4.3.0 or later, checks that read the parent now see what the type loads, even for a row returned from a plain `t.field`. Resolvers still get the original row.
