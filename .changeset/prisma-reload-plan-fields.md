---
'@pothos/plugin-prisma': patch
---

A field whose parent was loaded without its selection, reached at one response path through fragments on different types, now loads what its own branch selects instead of reusing the query planned for the other branch.
