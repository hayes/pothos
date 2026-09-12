---
'@pothos/plugin-prisma': patch
---

Fix `relatedConnection` fields with a custom `resolve` when the parent row was not planned:

- The fallback planned its query from the connection wrapper type, which has no prisma model, so an unplanned parent threw `Expected UserPostsConnection to have a model` before the custom resolver ran. The field now records the node type, the `nodes`/`edges.node` paths and the cursor selection to seed, and the fallback plans from those.
- `totalCount` on the fallback branch had no count source and resolved `null` on a non-nullable `Int`. It is now counted from the parent, only when the document selects it, and reaches user-defined fields on the connection object as the same number the generated `totalCount` field gets. When the parent does not correspond to a row — which only a custom `resolve` can produce — the field now errors naming the field and model rather than reporting a count of `0`.
- `hasNextPage` was always `false` on the fallback branch, because the page size was read from the plan's selection map instead of the connection query, so the extra probe row was never sliced off.
- A `totalCount`-only selection no longer runs the custom `resolve` for rows it would discard, matching what the loaded path already did.
