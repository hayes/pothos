---
'@pothos/plugin-scope-auth': minor
---

Scope and grant checks that read the parent can see the full parent row when a plugin such as `@pothos/plugin-prisma-next` supplies it, instead of only what the parent field returned. Resolvers still get the original parent.
