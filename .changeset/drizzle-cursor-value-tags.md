---
"@pothos/plugin-drizzle": patch
---

Tag each value in a compound cursor, so cursors covering more than one column round trip `Date` and `bigint` values.

Compound cursors were serialized with plain JSON, which returns a `Date` as a string and cannot serialize a `bigint` at all. Single-value cursors did not have this problem, so it only surfaced on orderings that named more than one column. Cursors written before this change are still read.

Also fixes two crashes reachable from the same orderings: an ordering value of `null` now compares with `IS NULL` rather than throwing out of drizzle, and composite primary keys are looked up against the table's own columns, which the postgres dialect does not use when reporting them.
