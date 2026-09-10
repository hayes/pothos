---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

`queryFromInfo` (prisma) and a connection helper's `getQuery` (both plugins) take an
`awaitSelections` option, and build the query synchronously without it.

Whether the query can be built synchronously turns on whether any selection beneath the field is
async, which is a property of the document rather than of the call: the subtree is not visible
where the query is asked for. A call that did not ask for a promise now throws, naming the field
and the option, rather than returning one where the declared type said there was none — a promise
spread into a prisma or drizzle call is one unusable key and no type error. Pass
`awaitSelections: true` to get the query as a `MaybePromise` and `await` it.

The return type follows the option's literal type, so the default keeps the plain query. A
non-literal `boolean` gets the `MaybePromise`, since the call cannot rely on the synchronous type
either.

Async selection callbacks have not been released, so no published schema can reach the throw and
nothing here is a migration. Async selections stay allowed everywhere they were.
