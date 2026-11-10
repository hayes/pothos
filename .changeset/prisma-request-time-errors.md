---
'@pothos/plugin-prisma': patch
---

Clients now see `Unexpected error.` for mistakes in the app that only show up during a request. The original message is on `error.cause`. This covers `Missing findUnique for <type>`, `Unable to find delegate for model <model>`, and `Unable to load totalCount for <field>: ...`. These errors are now plain `Error`s rather than `PothosError` or `GraphQLError` instances.
