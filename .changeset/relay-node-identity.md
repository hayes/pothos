---
"@pothos/plugin-relay": minor
---

Key node identity on the raw (pre-parse) global ID instead of the parsed `id`, so distinct
nodes whose `id.parse` results stringify alike no longer collapse onto one entity. Previously
`parse` results like `{ key: 1 }` and `{ key: 2 }` both became `Type:[object Object]`, and two
`Date`s in the same second both became the same key, so a `nodes` query could return the same
row twice. Cache keys are unchanged for nodes without an `id.parse`.

Also apply `id.parse` to node ids supplied to `t.node`/`t.nodeList` as a `GlobalIDShape`
(`{ id, type }`). That path previously skipped `parse` and handed `loadOne`/`loadMany` a raw
id, despite both being typed to receive the parsed `IDShape`.

That last change is a runtime behaviour change for working code, which is why this is a minor
rather than a patch. A `t.node({ id: () => ({ id: 'abc-uuid', type: User }) })` whose `parse`
validates its input used to resolve the node and call `loadOne('abc-uuid')`; it now runs
`parse` first, so a `parse` that rejects `'abc-uuid'` makes the field resolve to `null` with
that error instead. Nodes without an `id.parse`, and every path that supplies a global ID
string, are unaffected.
