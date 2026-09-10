---
'@pothos/plugin-drizzle': minor
---

`t.relatedCount` and a `t.relatedConnection`'s `totalCount` now count the rows the connection pages
over. The parent-to-child SQL is built by drizzle's `relationToSQL` instead of being reassembled
from the relation's source and target columns, so the plugin and the relational query builder agree
on what "related" means.

- New builder option `drizzle.filterConnectionTotalCount` (default `true`): `totalCount` on a
  `t.relatedConnection` applies the `where` returned by the field's `query`, so it counts the same
  rows the connection paginates. Previously it reported the unfiltered count. Set the option to
  `false` to keep counting every related row regardless of the filter, matching the prisma plugin's
  option.
- A count over a many-to-many relation (one defined with `.through(...)`) counts related rows. The
  junction table was left out, which compared the parent's key to the target's key instead: the
  count came back as the number of target rows that happen to share an id with the parent, with no
  error. The same correction applies to the filter `t.relatedField` hands to its `select` callback.
- A count honours a `where` declared on the relation itself, and the `where` a relation without
  `from`/`to` inherits from the relation it reverses. Both were dropped, so the count included rows
  the connection does not page over.
- The count reads the relation's source column off the parent by its typescript name, as every
  other read of a row does. A table declaring `postId: integer('id')` carries it as `postId`, so
  the count bound `undefined` and the driver rejected the query with "undefined cannot be passed as
  argument to the database".
- `totalCount` and the query that pages the relation are now the same predicate: the count selects
  from what the page query selects from and repeats its `where` clause, minus the limit, the
  ordering and the keyset clauses.
- A count over a many-to-many relation joins the junction table by its index, and a related row
  reachable through two junction rows still counts once.
- A `drizzleConnection` declared `nullable: false` no longer queries rows for a document that
  selects only `totalCount`. The check that recognises a count-only selection read the field's
  return type without unwrapping it, so a non-null connection never matched and always loaded a
  page of rows it then discarded. Nullable connections were already unaffected.
