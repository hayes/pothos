---
'@pothos/selection-mapper': patch
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

The callbacks that build a selection may be async.

- A field's `select` function, a relation `query` callback, a `relationCount` / `relatedCount`
  `where` callback, and the `select` / `query` callbacks of `prismaConnectionHelpers` and
  `drizzleConnectionHelpers` may return promises. Async argument mappers (such as the validation
  plugin's) are awaited before the field's `select` runs. Prisma previously accepted an async
  `select` and silently dropped it.
- The plugin still builds one query: callbacks start in the same tick, and what they return is
  merged after every synchronous selection, in document order. Schemas without async callbacks are
  unaffected: until a callback returns a promise, planning and resolving create no promise and no
  closure they did not create before.
- Inside an async `select`, `await` the result of `nestedSelection` (and of `getQuery` from the
  connection helpers) before adding it to the selection; a selection holding the promise itself
  throws with a message naming the relation, and a `select` that returns while a nested selection
  it started is still pending throws with a message naming the field. `queryFromInfo` returns a
  promise when a callback beneath the field is async, and must then be awaited; its declared type
  stays synchronous. The `query()` builder handed to a `drizzleField` or `drizzleConnection`
  resolver never returns a promise: the plan is settled before the resolver runs. A selection
  passed to `query()` comes first, as for `queryFromInfo`: a relation the document also plans
  with other arguments loads on its own, whether or not a selection beneath the field is async.
