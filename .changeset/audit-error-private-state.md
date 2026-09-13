---
'@pothos/plugin-errors': patch
---

Read wrapped error getters and call error methods on the original instance so private fields work, including sealed and frozen errors. Preserve constructor identity and proxy invariants for fixed own methods.
