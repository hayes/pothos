---
'@pothos/selection-mapper': patch
---

A `nestedSelection` path that doesn't fit the field's type (a field or pinned type the schema doesn't have, or a segment that isn't an object or interface) now reaches clients as `Unexpected error.`, with the detail in the error's `cause`.
