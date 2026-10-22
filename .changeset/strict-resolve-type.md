---
"@pothos/core": minor
"@pothos/plugin-dataloader": minor
---

Allow union `types` to be a record whose keys `resolveType` returns, and add a `StrictResolveType` schema types option that limits `unionType` and `loadableUnion` members to a record or names, and their `resolveType` to members. `@pothos/core` now requires TypeScript 5.4 or later.
