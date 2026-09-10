---
'@pothos/plugin-drizzle': patch
---

The error for a `drizzleObject` and a `drizzleInterface` it implements being built on different
tables names drizzle rather than prisma. It read "must be based on the same prisma model as any
DrizzleInterfaces they extend"; it now says "the same drizzle table".
