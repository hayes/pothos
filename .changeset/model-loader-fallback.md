---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

When a field's data is missing from the parent row it falls back to the model loader, which
reloads the row. That fallback now loads the right row, and loads more of it.

- The loaded row also carries the parent type's type-level `select`/`include` (prisma) or
  type-level columns, relations and extras (drizzle), since that row replaces the parent the
  resolver sees. Fallback queries therefore load more than before: the parent type's own columns
  and its type-level relations. The field's own selection always wins — a type-level relation
  whose arguments conflict with it is left out of that query — and when a prisma type-level
  `_count` has several counts and one conflicts with the count a field selects for itself, the
  loader keeps the other counts instead of dropping `_count` altogether.
- Drizzle: `t.relation`, `t.relatedCount` and `t.relatedConnection` fall back to the loader when
  their data is missing from the parent row — most often because the row was returned by a
  resolver that fetched it itself. Previously the loader was reached only when the field had no
  loader mapping at all, and a row without the relation on it resolved as `undefined` or as an
  empty page. `t.relatedConnection` decides what it has by reading its selection at resolve time
  the same way the planner does, through fragments, `@skip`/`@include`, and a wrapping type, so a
  row that carries the relation rows but not the count reloads rather than reporting `totalCount`
  as `undefined`.
- Prisma: a model load that failed before its query was sent hung the request instead of returning
  an error. The loader batches the rows it reloads and sends one query per row on the next tick. A
  throw while building any of those queries, most reachably `findUnique: null`, which throws
  `Missing findUnique for <type>`, abandoned every row it had not reached yet, so those fields
  never resolved and never errored and the request never finished. Every row in the batch now
  rejects with that error, matching what `@pothos/plugin-drizzle` already did.
- Prisma: the per-row fallback plan is cached. When a relation or related connection has a
  user-supplied `resolve` and the planned query did not load it, the field's resolver plans the
  field for itself; that planning ran again for every row of the list its parent came from. It is
  now cached per `Type@path` per request, the way `ModelLoader` already caches its own entry point
  and under the same key: the plan is settled once and played per call, so each row still gets a
  query of its own and still records the same mappings under the same keys. On a document with 161
  such resolutions the planning cost falls from about 405µs to about 68µs per request, with the
  queries issued and the response unchanged.
