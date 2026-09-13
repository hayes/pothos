---
"@pothos/plugin-complexity": patch
---

Detect cyclic fragment traversal and report it through GraphQL validation errors. Memoize each selection set and type within one calculation while adding its cost for every occurrence, so compact repeated-fragment documents no longer cause exponential work or evade timely complexity validation.
