---
"@pothos/plugin-directives": patch
---

- Support directives with multiple allowed locations in the ordered array format.
- Expand repeated directive arguments into separate directives in the ordered format, whether
  supplied through extensions, the `directives` option, or both.
- Support directive names such as `constructor` in the unordered format.
