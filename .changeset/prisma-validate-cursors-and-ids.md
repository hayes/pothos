---
'@pothos/plugin-prisma': patch
---

Malformed cursors and node IDs are now rejected with `Invalid cursor` or `Invalid ID` before they reach Prisma, and the error no longer echoes the input. IDs such as `1abc` or `1.9` no longer resolve to row 1.
