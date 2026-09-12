---
'@pothos/plugin-prisma-next': patch
---

Narrow the parent shape of the cross-file field helpers (`prismaObjectField`,
`prismaObjectFields`, `prismaInterfaceField`, `prismaInterfaceFields`) and of
`prismaNode` to the dependencies that were actually declared.

These helpers defaulted their parent `Shape` to the full `Row<Types, M>`, so a
resolver added with the model-name string form was typed as if every column
were loaded, when the plugin only loads what some `select` or `t.expose*`
declared. Reading an unselected column compiled and then failed at query time
with `Cannot return null for non-nullable field`. The string form now starts
from the same brand-only `ObjectBaseShape` that `prismaObject` uses, and
`prismaNode` computes its parent from its own `select` like `prismaObject`
does. Field-level `select` still layers on additively, `t.expose*` and
`t.relation` are unaffected, and the ref form is unchanged.

`prismaNode`'s custom `id.resolve` additionally receives the columns named by
`id.field` — single or compound — since those are selected for the ID field
already, so it needs no redundant object-level `select`.

Runtime behaviour is unchanged — declaring `select` is still how a field
adds a column dependency. To opt back into the old parent type, pass `Shape`
explicitly: `builder.prismaObjectField<'User', Row<Types, 'User'>>('User', …)`.
