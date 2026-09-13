---
"@pothos/plugin-validation": patch
---

Run chained input schemas in declaration order, including when an input type also has a
`validate` option. Continue the chain after a schema transforms a value to `null`.

The `validate` option runs after chained `.validate()` schemas, which were previously skipped
when both were present. A chain that reshapes a value can now fail the options schema. TypeScript
still describes the last chained schema's output because the `validate` option does not change
the input ref's type.
