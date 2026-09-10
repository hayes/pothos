---
'@pothos/plugin-drizzle': patch
---

A `drizzleConnection` declared `nullable: false` no longer queries rows for a document that
selects only `totalCount`. The check that recognises a count-only selection read the field's
return type without unwrapping it, so a non-null connection never matched and always loaded a
page of rows it then discarded. Nullable connections were already unaffected.
