---
'@pothos/selection-mapper': minor
---

`fieldKey(type, info)` keys a plan cached for a field on the type, the response path and the field nodes graphql merged for it, so fragments on different types that reach one response path get separate plans.

`forExecution(cache, info)` keeps entries per execution, as loader mappings are kept, so each subscription event gets its own.
