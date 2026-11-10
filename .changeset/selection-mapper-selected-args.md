---
'@pothos/selection-mapper': minor
---

The `selectedFieldNode` a select function receives has `args(path)`, which returns the arguments of the field selected at `path`, seen through wrappers. It throws when the fields selected there have different arguments, including beneath a parent field that is itself selected more than once.
