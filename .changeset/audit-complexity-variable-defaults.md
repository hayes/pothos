---
"@pothos/plugin-complexity": patch
---

Coerce operation variables before standalone and validation-rule complexity calculations, including variable and nested input defaults. Defaulted limits now contribute their actual cost; invalid variables produce GraphQL errors instead of a misleading complexity result. Preserve GraphQL 16 and 17 variable-value representations.
