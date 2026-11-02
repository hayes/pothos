---
'@pothos/plugin-drizzle': patch
---

Reduce type-check time for large schemas: the `client` option no longer compares every table's `findMany` signature, and `relatedConnection` types its connection and edge options with the node shape instead of a list shape.
