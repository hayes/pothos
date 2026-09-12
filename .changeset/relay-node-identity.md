---
"@pothos/plugin-relay": patch
---

Key node identity on the raw (pre-parse) global ID instead of the parsed `id`, so distinct
nodes whose `id.parse` results stringify alike no longer collapse onto one entity. Previously
`parse` results like `{ key: 1 }` and `{ key: 2 }` both became `Type:[object Object]`, and two
`Date`s in the same second both became the same key, so a `nodes` query could return the same
row twice. Cache keys are unchanged for nodes without an `id.parse`.
