---
"@pothos/plugin-scope-auth": patch
---

Cache scope map results per strategy so a map shared between `$any` and `$all` is not resolved by whichever field executes first
Keep an explicit `$any` narrowed to a union of its auth contexts when the default strategy is `all`
