---
"@pothos/plugin-drizzle": patch
---

Fix column selection logic when merging selections

* When `select` on Types and Fields does not contain `columns` no additional columns are selected
* All nested selections (in `with`) match drizzle query API, where no explicit `columns` means all columns are selected
* Inferred types now correctly match the selection logic above
