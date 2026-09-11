---
'@pothos/core': minor
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

Selections can be built by async callbacks. New `AsyncSelections` flag in the schema types, off by
default.

- `AsyncSelections: true` widens what the selection callbacks accept: a field's `select` function,
  a relation `query` callback, a `relationCount` / `relatedCount` `where` callback, and the
  `select` / `query` callbacks of `prismaConnectionHelpers` and `drizzleConnectionHelpers` may all
  return promises. Without the flag they are typed as synchronous and an async callback is a type
  error, which is what the prisma plugin needed: it accepted an async `select` and silently
  dropped the selection it resolved to.
- The plugins still build one query. Callbacks start in the same tick, and what they return is
  merged after every synchronous selection, in document order. Async argument mappers (such as the
  validation plugin's) are awaited before the field's `select` runs. A schema with no async
  callbacks is unaffected either way: until a callback returns a promise, planning and resolving
  create no promise and no closure they did not create before.
- Inside an async `select`, `await` the result of `nestedSelection` before adding it to the
  selection. A `select` that returns while a nested selection it started is still pending throws,
  naming the field.
- Everything the plugins generate settles its plan before your resolver runs, so a schema built
  only from `t.relation`, `t.relationCount` / `t.relatedCount`, `t.prismaField` /
  `t.drizzleField`, `t.prismaConnection` / `t.drizzleConnection` and `t.relatedConnection` can
  turn the flag on and change nothing else. The `query()` builder handed to a `drizzleField` or
  `drizzleConnection` resolver never returns a promise for the same reason.
- The places where your own code asks for a query or a selection are the ones to audit:
  `queryFromInfo` (prisma), a connection helper's `getQuery` (both plugins), `nestedSelection`,
  and `mergeNestedSelection`. `queryFromInfo` and `getQuery` build the query synchronously and
  take an `awaitSelections` option; pass `awaitSelections: true` to get a `MaybePromise` and
  `await` it. A call that did not ask for a promise throws, naming the option and what the call
  was building — `queryFromInfo` the field, `getQuery` the connection's model or table, which is
  as much as it is given — rather than returning one where the declared type said there was none:
  a promise spread into a prisma or drizzle call is one unusable key and no type error. Two things
  make the query async. One is a selection beneath the field, which is a property of the document
  rather than of the call site. The other is the helper's own `select` or `query` callback: an
  async one makes `getQuery` throw for a fully synchronous document, since it is the helper's own
  callback that has not settled. The return type follows the option's literal type, so the default
  keeps the plain query; a non-literal `boolean` gets the `MaybePromise`, since the call cannot
  rely on the synchronous type either.
- A selection passed to drizzle's `query()` comes first, as it does for `queryFromInfo`: a
  relation the document also plans with other arguments loads on its own.
