---
"@pothos/plugin-validation": patch
---

Run chained input object schemas in declaration order
Keep chained input type schemas when the input type also sets a `validate` option
Continue validator chains after a schema successfully transforms a value to `null`
