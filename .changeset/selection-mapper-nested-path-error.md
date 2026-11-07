---
'@pothos/selection-mapper': patch
---

A `nestedSelection` path that doesn't match the field's selection now reaches clients as `Unexpected error.`, with the detail in the error's `cause`.
