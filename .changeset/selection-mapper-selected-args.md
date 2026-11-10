---
'@pothos/selection-mapper': minor
---

The `selectedFieldNode` a select function receives has `args(path)`, which returns the arguments of the field selected at `path`, seen through wrappers. It throws when the fields selected there have different arguments, including beneath a parent field that is itself selected more than once.

`fieldKey(type, info)` keys a plan cached for a field on the type, the response path and the field nodes graphql merged for it, so fragments on different types that reach one response path get separate plans.

`forExecution(cache, info)` keeps entries per execution, as loader mappings are kept, so each subscription event gets its own.
