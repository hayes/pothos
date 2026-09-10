---
'@pothos/plugin-prisma': patch
---

Prisma plugin fixes.

- A relation `query` returning keys set to `undefined` (`{ where: cond ? filter : undefined }`) is
  now treated as compatible with a sibling selection of the same relation. Previously the sibling
  fell back to a separate query per row whenever the condition was false.
- `onNull` now receives `args`, `context`, and `info`. Previously it was called with empty objects,
  so any callback reading them threw at runtime.
- A `relatedConnection` selected through more than one fragment (two success fragments of an
  errors-plugin result, one selecting `totalCount` and one `edges`) now plans both the count and
  the rows; it is planned as totalCount-only only when none of `edges`, `nodes` or `pageInfo` is
  selected anywhere, matching the resolver.
- A connection whose document selects neither `nodes` nor `edges { node }` (only `pageInfo`, say)
  now loads only the cursor columns of the related rows instead of every column. The response is
  the same; the query stops reading columns nothing can ask for.
- `_count: true` in a type-level or field-level `select` is kept and passed to prisma as
  `_count: true`; it is spelled out per list relation only when a filtered named count has to be
  selected alongside it.
- Registering the same prisma model as both an object and an interface silently returned the first
  ref for both. `builder.prismaInterface('User', ...)` after `builder.prismaObject('User', ...)`
  (in either order) handed back the ref that was created first, typed as the kind that was asked
  for. It now throws, naming the model and pointing at `variant`, the way `@pothos/plugin-drizzle`
  does for tables. `builder.prismaInterfaceField(s)` given a model name also names that model's
  interface now, rather than its object.
