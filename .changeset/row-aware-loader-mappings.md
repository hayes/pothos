---
'@pothos/selection-mapper': patch
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

A loader mapping now belongs to the row it was recorded for, not to the response path alone.

Mappings are keyed by the response path with list indices dropped, so one key serves every row of
a list. That is right while every row of the list was loaded by the same plan. A list can return
rows of mixed loaded state — some carrying what the planned query selected and some not — and the
rows that do not fall back to the model loader, which plans the same fields again and records
mappings of its own. Those used to replace the plan's at the shared key, so a row that read the
key afterwards answered from a plan that never loaded it: a `relatedConnection` beneath such a row
paged with the fallback's arguments against rows the planned query had fetched, giving that row a
different edge set and a wrong `hasNextPage` than its siblings, with no error and no extra query.

Where two plans now disagree about a key, the second is recorded against its own row instead of
replacing the first, and a resolver is answered from the mapping recorded for the row it holds.
Rows loaded the same way still share one entry per path, and a request whose rows never disagree
records nothing per row.
