---
"@pothos/plugin-validation": patch
---

Run chained input object schemas in declaration order
Keep chained input type schemas when the input type also sets a `validate` option
Continue validator chains after a schema successfully transforms a value to `null`

Behavior change: chaining `.validate()` on an input type that also passes a `validate` option previously dropped the chained schemas entirely. They now run, in declaration order, followed by the options schema — the same order already used for arguments and input fields. Because the options schema runs last, a chained schema that reshapes the value (so the options schema no longer matches the reshaped value) can now fail at runtime where it previously silently returned the options schema's output. Note that `.validate()` re-types the input ref while the `validate` option does not, so TypeScript still describes the value as the last chained schema's output in that case.
