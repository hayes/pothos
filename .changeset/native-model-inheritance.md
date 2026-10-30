---
'@pothos/plugin-prisma-next': minor
---

Map native model inheritance onto GraphQL. `builder.prismaInterface('Task', ...)` on a base model
routes rows to implementing types by discriminator, and `... on Bug` fragments plan into the same
query. `builder.prismaObject('Bug', ...)` exposes inherited columns and relations. Fields returning a
variant model require `orm.Task.variant('bug')`, because `orm.Bug` isn't filtered by discriminator.
