---
'@pothos/plugin-prisma-next': patch
---

Narrow resolver parent types for `prismaObjectField`, `prismaObjectFields`,
`prismaInterfaceField`, and `prismaInterfaceFields` when called with a model-name string. Parents
now include only declared selections instead of every model column. Ref-based calls are unchanged.
`prismaNode` parents likewise reflect its `select`; custom `id.resolve` callbacks also receive the
single or compound columns named by `id.field`.

Field-level selections remain additive, and `t.expose*`, `t.relation`, and selection-key validation
are unchanged. Runtime loading is unchanged. To supply the full row type explicitly, use
`builder.prismaObjectField<'User', Row<Types, 'User'>>('User', …)`.
