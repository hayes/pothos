---
"@pothos/plugin-scope-auth": patch
---

Cache scope map results per strategy so a map shared between `$any` and `$all` is not resolved by whichever field executes first
Keep a top-level `$any` narrowed to a union of its auth contexts when the default strategy is `all`, instead of intersecting them. This is a type-only change, but it is a compile break: a resolver that read a context guaranteed only by the other branch of the `$any` (`context.user.id` under `t.withAuth({ $any: { user: true, admin: true } })`) compiled before and no longer does. It ships as a patch because the old type claimed a guarantee runtime never made, and such resolvers throw whenever the other scope is the one that authorized the request. A `$any` nested inside a `$all` is still intersected, unchanged from before.
