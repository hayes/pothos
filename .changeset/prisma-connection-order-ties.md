---
'@pothos/plugin-prisma': patch
---

`relatedConnection` and `prismaConnectionHelpers` connections over a non-unique `orderBy` now add the cursor's unique key as a final sort column, so pages read backward with `last` match the pages read forward. `first` together with `last` now pages forward by `first`, as `@pothos/core` does.
