---
'@pothos/plugin-drizzle': patch
---

The parent-to-child SQL for a relation is now built by drizzle's `relationToSQL` instead of being
reassembled from the relation's source and target columns, so the plugin and the relational query
builder agree on what "related" means.

- `totalCount` on a `t.relatedConnection` over a many-to-many relation (one defined with
  `.through(...)`) counts the rows the connection pages over. The junction table was left out of
  the count, which compared the parent's key to the target's key instead: the count came back as
  the number of target rows that happen to share an id with the parent, with no error.
- `t.relatedCount` and the filter `t.relatedField` hands to its `select` callback match the
  related rows for a many-to-many relation, as an `exists` over the junction table.
- A count honours a `where` declared on the relation itself, and the `where` a relation without
  `from`/`to` inherits from the relation it reverses. Both were dropped, so the count included
  rows the connection does not page over.
