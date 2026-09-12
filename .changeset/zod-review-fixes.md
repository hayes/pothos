---
"@pothos/plugin-zod": patch
---

Apply `min`, `max`, `minLength` and `maxLength` constraints when the bound is `0`
Run every constraint in a refinement array, including arrays that mix tuples and bare functions
Treat a `[false, { message }]` boolean constraint as disabled, matching a bare `false`
Validate arguments before a subscription's source stream is created, not only in the resolver
