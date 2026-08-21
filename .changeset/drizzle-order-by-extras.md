---
"@pothos/plugin-drizzle": minor
---

Connection `orderBy` can now name an extra selected by the same query, rather than only a column:

```ts
query({
  extras: { titleLength: (table) => sql`length(${table.title})` },
  orderBy: { titleLength: 'asc' },
})
```

Pothos orders by the expression, builds the cursor from the value it returns, and compares the expression when paging.

This gives cursors a way to carry a value the column's JavaScript mapping does not preserve. A `timestamp({ mode: 'date' })` column is returned as a `Date`, which only holds milliseconds, so a cursor built from it cannot address a row stored with microsecond precision. Selecting the full value as an extra and ordering by that can. See "Ordering and cursors" in the drizzle plugin docs.
