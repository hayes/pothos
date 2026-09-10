---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

The callbacks that build a selection may be async, and the query is still built synchronously
unless the caller asks otherwise.

- A field's `select` function, a relation `query` callback, a `relationCount` / `relatedCount`
  `where` callback, and the `select` / `query` callbacks of `prismaConnectionHelpers` and
  `drizzleConnectionHelpers` may return promises. Async argument mappers (such as the validation
  plugin's) are awaited before the field's `select` runs. Prisma previously accepted an async
  `select` and silently dropped it.
- The plugin still builds one query: callbacks start in the same tick, and what they return is
  merged after every synchronous selection, in document order. Schemas without async callbacks are
  unaffected: until a callback returns a promise, planning and resolving create no promise and no
  closure they did not create before.
- Inside an async `select`, `await` the result of `nestedSelection` before adding it to the
  selection; a `select` that returns while a nested selection it started is still pending throws
  with a message naming the field.
- `queryFromInfo` (prisma) and a connection helper's `getQuery` (both plugins) take an
  `awaitSelections` option and build the query synchronously without it. Whether it can be built
  synchronously turns on whether any selection beneath the field is async, which is a property of
  the document rather than of the call: the subtree is not visible where the query is asked for. A
  call that did not ask for a promise throws, naming the field and the option, rather than
  returning one where the declared type said there was none — a promise spread into a prisma or
  drizzle call is one unusable key and no type error. Pass `awaitSelections: true` to get the query
  as a `MaybePromise` and `await` it. The return type follows the option's literal type, so the
  default keeps the plain query; a non-literal `boolean` gets the `MaybePromise`, since the call
  cannot rely on the synchronous type either.
- The `query()` builder handed to a `drizzleField` or `drizzleConnection` resolver never returns a
  promise: the plan is settled before the resolver runs. A selection passed to `query()` comes
  first, as for `queryFromInfo`: a relation the document also plans with other arguments loads on
  its own, whether or not a selection beneath the field is async.

Async selection callbacks have not been released, so no published schema can reach the throw and
nothing here is a migration.
