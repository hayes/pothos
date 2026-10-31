---
'@pothos/selection-mapper': patch
---

Walk fragments on abstract types without a model (such as `... on Node`) instead of dropping their fields, let object types accept fragments on unions that contain them, and compare opaque values such as Temporal instances with `equals`. `Plan.forParentRow` takes an `initial` selection, and `Mapping` is exported.
