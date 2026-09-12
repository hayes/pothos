---
"@pothos/plugin-relay": patch
---

- Cap backward (`last`) page size against `maxSize` before deriving the start offset, so trimming keeps the last requested items
- Clamp offset windows when a stale `after` cursor points past `totalCount`, instead of producing a negative limit and `hasNextPage: true`
- Group node ids in a `Map` so node types named `constructor`, `toString`, etc. no longer throw when loaded
- Infer node types from readonly arrays returned by `resolveCursorConnection` resolvers instead of `never`
