---
'@pothos/plugin-prisma': patch
---

Errors from mistakes in the app that only show up during a request now reach clients as `Unexpected error.`, with the original message on the error's `cause`. This covers `Missing findUnique for <type>`, `Unable to find delegate for model <model>`, and `Unable to load totalCount for <field>: ...`. These errors are now plain `Error`s rather than `PothosError` or `GraphQLError` instances.
