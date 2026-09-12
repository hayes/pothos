---
"@pothos/plugin-relay": patch
---

- Cap backward (`last`) page size against `maxSize` before deriving the start offset, so trimming keeps the last requested items
- Clamp offset windows to the size of the collection when a cursor points past the end of it: a stale `after` cursor no longer produces a negative limit and `hasNextPage: true`, and a stale `before` cursor now pages off the real end instead of returning an empty page
- Group node ids in a `Map` so node types named `constructor`, `toString`, etc. no longer throw when loaded
- Infer node types from readonly arrays returned by `resolveCursorConnection` resolvers instead of `never`
- Type the results of `resolveCursorConnection` and `resolveOffsetConnection` as nullable when their resolvers can return `null`, instead of non-null connections that threw on unguarded `.edges`. Resolvers typed `any` are unaffected
