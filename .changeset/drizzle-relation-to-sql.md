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
  related rows for a many-to-many relation, rather than the target rows sharing an id with the
  parent.
- A count honours a `where` declared on the relation itself, and the `where` a relation without
  `from`/`to` inherits from the relation it reverses. Both were dropped, so the count included
  rows the connection does not page over.
- `totalCount` and the query that pages the relation are now the same predicate: the count selects
  from what the page query selects from and repeats its `where` clause, minus the limit, the
  ordering and the keyset clauses. They agreed in result before, but were built by different routes
  and ordered their conditions differently.
- `t.relatedCount` over a many-to-many relation reads the junction table by its index instead of
  filtering the target table by an `exists`. Postgres rewrote that `exists` into a semijoin and was
  unaffected; sqlite scanned the target table once per parent row, which over a thousand parents and
  a few thousand target rows took a second where the count now takes a millisecond. The count is the
  same: a related row reachable through two junction rows still counts once.
- None of this is written as SQL text any more. `exists`, the junction join and the count come from
  drizzle's own operators and query builder, so the plugin emits what the relational query builder
  emits for the same relation.
