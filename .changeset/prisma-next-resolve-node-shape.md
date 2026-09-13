---
'@pothos/plugin-prisma-next': patch
---

Infer connection node types from `prismaConnectionHelpers.resolveNode`. With a custom
`resolveNode`, `wrap` now requires full model rows and returns the callback's output type. Passing
narrowed rows to such a helper is now a type error.

A conditional `resolveNode` produces a union of its output and the original row. Helpers without
`resolveNode` still infer nodes from the rows passed to `wrap`. The new fourth type parameter on
`PrismaConnectionHelpers` is optional, so existing type references remain valid.

Runtime behavior is unchanged; cursors still use the original rows.
