---
"@pothos/plugin-errors": patch
---

- Resolve promised list items before matching declared error types. Wrap errors only at the list
  level covered by the generated union; errors in nested lists retain their original messages.
- Preserve builder defaults for generated result fields and union extensions, including the
  `defaultItem*` options. Generated `*Success` types now include fields from `defaultResultOptions.fields`
  and `defaultItemResultOptions.fields`, changing the SDL where these options are configured.
- Support frozen declared errors without violating Proxy invariants.
- Preserve shared error result types for inherited interface fields.
