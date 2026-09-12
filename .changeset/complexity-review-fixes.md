---
"@pothos/plugin-complexity": patch
---

- Resolve operation root types by role so schemas with renamed roots work
- Treat a maximum of `0` as a real limit instead of as "no limit"
- Honor the schema-level `complexity.disabled` option passed to `toSchema`
- Reset validation rule state per operation so operations are measured independently. For a document with multiple operations, `createComplexityRule`'s `onResult` callback is now called once per operation with that operation's own cost, rather than with a running total across the document.
