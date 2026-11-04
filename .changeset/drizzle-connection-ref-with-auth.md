---
'@pothos/plugin-drizzle': patch
---

`drizzleConnection` now accepts a `drizzleObject` or `drizzleNode` ref as its `type` the same way it accepts a table name. Drizzle object field builders now have `t.withAuth`, as prisma object field builders do.
