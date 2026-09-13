---
"@pothos/plugin-errors": patch
---

- Resolve promised list items before matching them against declared error types, so fulfilled and rejected declared errors become union members instead of GraphQL errors. Errors are now only wrapped at the list level the generated item union actually covers, so errors and rejections in nested lists are reported with their original message instead of becoming invalid values for the real item type
- Keep builder level `defaultResultOptions.fields` and `defaultUnionOptions.extensions` (and their `defaultItem*` equivalents) on generated success and union types. Note that this changes the generated SDL: schemas that configure `defaultResultOptions.fields` or `defaultItemResultOptions.fields` will gain those fields on every generated `*Success` type, where they were previously dropped
- Wrap non-extensible (frozen) declared errors without violating Proxy invariants
