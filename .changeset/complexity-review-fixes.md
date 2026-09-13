---
"@pothos/plugin-complexity": patch
---

- Support renamed operation roots.
- Enforce limits set to `0`.
- Honor `complexity.disabled` passed to `toSchema`.
- Measure each operation independently. For documents with multiple operations,
  `createComplexityRule.onResult` now runs once per operation with that operation's cost.
