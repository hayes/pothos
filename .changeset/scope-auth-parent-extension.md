---
'@pothos/plugin-scope-auth': minor
---

With `runScopesOnType`, type scopes can see the full parent row when a plugin such as `@pothos/plugin-prisma-next` supplies it, instead of only what the parent field returned. If that parent fails to load, the type is denied as its first check would deny it, with the load error as the denial's `cause`.
