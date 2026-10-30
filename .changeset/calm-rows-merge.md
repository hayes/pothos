---
'@pothos/plugin-prisma-next': patch
---

Fix selections that fail or return wrong data, and share queries where possible:

- Merge a callback `query` selected twice through fragments instead of rejecting it.
- Stop reading a model's `rows` or `count` member as a connection's rows or total.
- Stop JSON column contents from overwriting selected field values.
- Keep values on rows a resolver built itself, and resolve deleted rows, without a reload.
- Fail only the connection field when its cursor is invalid, and reject null cursor values on non-null columns.
- Reject a `prismaNode` `id.field` that isn't a non-null unique key at schema build.
- Make the non-FK side of a one-to-one relation nullable, following the contract.
- Read to-many aliases with the same query from one subquery.
- Serve conflicting interface and object prerequisites through separate fallback batches.
- Pass the ORM's callback `tools` to `where` callbacks.
