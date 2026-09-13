---
'@pothos/plugin-scope-auth': minor
---

Cache scope map results per strategy so a map shared between `$any` and `$all` is not resolved by whichever field executes first
Keep a top-level `$any` narrowed to a union of its auth contexts when the default strategy is `all`, instead of intersecting them. This is a type-only change, but it is a compile break: a resolver that read a context guaranteed only by the other branch of the `$any` (`context.user.id` under `t.withAuth({ $any: { user: true, admin: true } })`) compiled before and no longer does. It ships as a patch because the old type claimed a guarantee runtime never made, and such resolvers throw whenever the other scope is the one that authorized the request. A `$any` nested inside a `$all` is still intersected, unchanged from before.

Apply implementing-object policies to inherited interface fields, alongside the declaring
interface's policy. This requires core 4.15 or later. Authorization steps are built with each
owner's field config; fields without authorization work retain the default resolver fast path.

**Inherited fields can newly deny access** when the object's `authScopes` or another implemented
interface's `authScopes` denies. The same policy applies when querying through an interface.
`runScopesOnType` on an object or globally retains its behavior. An interface's `runScopesOnType`
no longer lets inherited fields bypass that interface's policy; the object's interface checks
now enforce it.

`skipTypeScopes` on an inherited field skips the declaring interface's and object's own checks.
`skipInterfaceScopes` on the field or object skips interface checks, including the declaring
interface, while retaining the object's own check. Deliberately skipped checks are not reintroduced
through another inheritance path. Grants remain independent of these skip flags.

Two changes can newly authorize fields: the object's `grantScopes` now reach inherited fields,
and `skipInterfaceScopes` can suppress the declaring interface's check. Declaring-interface grants
continue to run when its authorization check is skipped.
