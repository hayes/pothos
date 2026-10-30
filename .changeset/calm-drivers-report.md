---
'@pothos/plugin-prisma-next': patch
---

Fail at schema build for non-SQL contracts, and report a missing count aggregate clearly when
`totalCount` is used on a database target without one, such as the MySQL preview.
