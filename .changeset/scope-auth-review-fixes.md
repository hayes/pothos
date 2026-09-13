---
'@pothos/plugin-scope-auth': minor
---

Cache scope-map results separately for `$any` and `$all`, so shared maps are evaluated with the
correct strategy regardless of field order.

With the `all` default strategy, a top-level `$any` now narrows auth contexts to a union rather
than an intersection. Resolvers that relied on context available in only another branch may no
longer compile; runtime authorization is unchanged. A `$any` nested in `$all` still uses an
intersection.

Apply implementing-object policies to inherited interface fields, alongside the declaring
interface's policy. Fields without authorization checks or grants keep their default resolver.

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
