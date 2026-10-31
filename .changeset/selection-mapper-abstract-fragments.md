---
'@pothos/selection-mapper': patch
---

Walk fragments on abstract types without a model (such as `... on Node`) beneath a model interface instead of dropping their fields, and compare opaque values such as Temporal instances through their `equals` method.
