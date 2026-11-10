---
"@pothos/plugin-complexity": minor
---

Support asynchronous argument mapping in complexity calculations with a MaybePromise result while preserving synchronous results for synchronous mappings. Await runtime limits before root resolvers and subscription source acquisition, share pending request calculations, and explicitly reject unsupported asynchronous calculations in synchronous GraphQL validation rules.

This is potentially breaking for some schemas and callers, but is released as a minor version because it corrects a bug that could underestimate query complexity and bypass configured limits. Schemas using asynchronous argument mapping with argument-dependent complexity may now reject requests that previously passed with an incorrectly low cost. The synchronous `createComplexityRule` now rejects asynchronous calculations; use an awaited `complexityFromQuery` check before execution instead. TypeScript callers of `complexityFromQuery` must await or narrow its `MaybePromise` result. Subscription limits are now enforced before acquiring the subscription source.
