---
"@pothos/plugin-drizzle": minor
---

Connection `orderBy` can now name an extra the query selects, rather than only a column:

```ts
query({
  extras: { titleLength: (table) => sql`length(${table.title})` },
  orderBy: { titleLength: 'asc' },
})
```

Pothos orders by the expression, builds the cursor from the value it returns, and compares the expression when paging.

This gives cursors a way to carry a value the column's JavaScript mapping loses. A `timestamp({ mode: 'date' })` column is read as a `Date`, which holds milliseconds, so a cursor built from it can't address a row stored at microsecond precision — selecting the full value as an extra and ordering by that can. See "Ordering and cursors" in the drizzle plugin docs.
