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

Because `resolveNode` is supplied when the helper is built, its parameter can only be
annotated with the model's full row. `wrap` now requires the full row whenever a
`resolveNode` is configured, so a callback that mentions its parameter — `(row) => row`, or
`(row) => ({ ...row, extra: 1 })` — can no longer launder that annotation into the node
type and promise columns the caller never loaded. Passing narrowed rows to such a helper is
now rejected at the `wrap` call, naming the missing columns.

A `resolveNode` supplied conditionally (`enabled ? fn : undefined`) may never run, and `wrap`
leaves the row untouched when it is absent. Such a helper's node is therefore typed as the
callback's result *or* the original row, so the caller has to narrow, rather than promising a
transform that did not happen.

Runtime behaviour is unchanged — the transform still runs after `buildConnectionPage`, so
each edge's cursor is still encoded from the original row.
