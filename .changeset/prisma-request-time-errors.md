---
'@pothos/plugin-prisma': patch
---

Errors from mistakes in the app that only show up during a request now reach clients as `Unexpected error.`, with the original message on the error's `cause`. This covers `Missing findUnique for <type>`, `Unable to find delegate for model <model>`, `Unable to load totalCount for <field>: ...`, and `Prisma query was unused in resolver for <field>` from `onUnusedQuery: 'error'`.
