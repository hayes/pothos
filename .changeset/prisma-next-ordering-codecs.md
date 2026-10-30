---
'@pothos/plugin-prisma-next': patch
---

Add an `orderBy` option to `t.prismaConnection` and `t.relatedConnection` that sets direction and
null placement per request. Nullable cursors now use native null placement instead of null-rank
expressions, so a preordered Collection states it with `{ nulls }`. Connections reject a Collection
using `distinct()` or `distinctOn()`.

Add a `prismaNext.context` option taking the client's `context`. Cursor columns can use
`codec: 'column'`, and object-valued fallback identities such as Temporal keys compare through the
column's codec.
