---
'@pothos/plugin-drizzle': minor
---

`totalCount` on `t.relatedConnection` now applies the `where` returned by the field's `query`, so it counts the same rows the connection paginates. Previously it reported the unfiltered count.

New builder option `drizzle.filterConnectionTotalCount` (default `true`). Set it to `false` to keep counting every related row regardless of the filter, matching the prisma plugin's option.
