---
'@pothos/plugin-prisma-next': patch
---

Infer the connection node shape from `prismaConnectionHelpers`' `resolveNode`

`resolveNode` replaces every `edge.node`, but `wrap` still declared its result as
`ConnectionPage<WrapRow>` — the row that was passed in. A helper configured with
`resolveNode: (row) => ({ post: row, decoratedAt: new Date() })` typed `edges[0].node.id`
as `string` while the runtime value was `undefined`, and strict `tsc` accepted it.

`resolveNode`'s return type is now inferred as a `Node` generic and resolved at `wrap`.
`PrismaConnectionHelpers` gains a defaulted fourth type parameter, so existing
`PrismaConnectionHelpers<Types, M, Args>` references keep compiling. Helpers without a
`resolveNode` are unaffected: `Node` stays at its `never` default and `wrap` keeps
inferring the node from its own argument, including rows narrowed before materializing.

Runtime behaviour is unchanged — the transform still runs after `buildConnectionPage`, so
each edge's cursor is still encoded from the original row.
