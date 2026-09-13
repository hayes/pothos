---
'@pothos/plugin-prisma': patch
---

Fix `relatedConnection` fields with a custom `resolve` when the parent row was not preloaded:

- Plan the fallback query from the connection's node type and cursor selections.
- Load `totalCount` only when selected and make it available to custom connection fields. A parent
  that does not exist now produces an error naming the field and model instead of a zero count.
- Compute `hasNextPage` from the requested page size and remove the extra probe row.
- Skip the custom row resolver for selections that request only `totalCount`.
