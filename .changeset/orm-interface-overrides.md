---
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

An object that overrides a field of the interface it implements now resolves that field with its own query when queried through the interface, instead of returning the interface's data.
