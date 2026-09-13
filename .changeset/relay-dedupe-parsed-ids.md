---
"@pothos/plugin-relay": patch
---

Load a node once per request when distinct global IDs parse to the same id. Keying the request
cache on the raw global ID meant any `id.parse` that is not injective over raw strings —
`Number`, `parseInt`, case or whitespace normalisation, UUID formatting, base64 padding — loaded
one node once per spelling. With `parse: (id) => Number(id)`, `nodes(ids: ["1", "01", "2"])` (as
global IDs) handed `loadMany` `[1, 1, 2]`, so a `WHERE id IN (...)` loader that maps results back
by index returned the wrong row for a requested position, and `loadOne` ran twice for one node.
Nodes are now cached both by raw global ID and by parsed id, so each distinct parsed id is loaded
once and every spelling of it resolves to that one instance, restoring the documented guarantee
that a node is loaded once per request. The parsed cache keys on the value itself rather than its
string form, so ids that merely stringify alike, such as `{ key: 1 }` and `{ key: 2 }` or two
`Date`s in the same second, stay distinct.

The raw global ID used for caching no longer appears as a `rawId` property on the decoded global
IDs passed to resolvers, where it had been showing up in `t.arg.globalID` arguments and in the
`args` given to a custom `relay.nodeQueryOptions.resolve`.
