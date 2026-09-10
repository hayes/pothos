---
'@pothos/selection-mapper': patch
---

The adapter contract is named for what each member does. `read` is `eachEntry`, `emit` is
`toQuery`, `create` is `createNode`, and the four merge rules are one family: `mergeQuery` and
`mergeNode` do the merge, `canMergeQuery` and `canMergeNode` answer whether it would change what
is already selected, and `firstConflict` (was `conflict`) names the entry an error message
reports. A node's `extras` are its `computed` values, and `extraConflicts` is `computedConflicts`:
"extra" is drizzle's word for its own query format, not the shared contract's word for a value the
ORM computes per row. Names only — the queries this package builds are unchanged, and neither ORM
plugin's public API mentions any of them.
