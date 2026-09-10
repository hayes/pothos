---
'@pothos/plugin-prisma': patch
---

Cache the per-row fallback plan. When a relation or related connection has a user-supplied
`resolve` and the planned query did not load it, the field's resolver plans the field for itself;
that planning ran again for every row of the list its parent came from. It is now cached per
`Type@path` per request, the way `ModelLoader` already caches its own entry point and under the
same key: the plan is settled once and played per call, so each row still gets a query of its own
and still records the same mappings under the same keys. On a document with 161 such resolutions
the planning cost falls from about 405µs to about 68µs per request, with the queries issued and
the response unchanged.
