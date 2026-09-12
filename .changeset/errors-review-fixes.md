---
"@pothos/plugin-errors": patch
---

- Resolve promised list items before matching them against declared error types, so fulfilled and rejected declared errors become union members instead of GraphQL errors
- Keep builder level `defaultResultOptions.fields` and `defaultUnionOptions.extensions` (and their `defaultItem*` equivalents) on generated success and union types
- Wrap non-extensible (frozen) declared errors without violating Proxy invariants
