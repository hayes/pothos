---
'@pothos/plugin-prisma': patch
---

Cursors and node IDs are now checked against their column's type, and fail with `Invalid cursor` or `Invalid ID` without echoing the input (this includes the error from `parsePrismaCursor`). IDs such as `1abc` or `1.9` no longer resolve to row 1, and a Boolean ID must be `true` or `false`.
