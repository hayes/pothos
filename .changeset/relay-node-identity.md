---
"@pothos/plugin-relay": minor
---

Fix node caching for parsed IDs. Distinct object IDs that stringify alike remain separate, while
repeated global IDs and IDs that parse to the same value share a cached result. Loaders configured
without caching still bypass the request cache.

Apply `id.parse` to IDs supplied to `t.node` and `t.nodeList` as `{ id, type }`, matching global ID
strings. These fields now pass parsed IDs to loaders and report an error if parsing fails; they
previously passed the raw ID through. Nodes without `id.parse` are unchanged.
