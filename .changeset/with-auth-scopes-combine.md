---
'@pothos/plugin-scope-auth': minor
---

Run `withAuth` and `authScopes` checks sequentially instead of letting the field's `authScopes` overwrite the scopes from `withAuth`. Fields that use both now require both checks to pass, and chained `withAuth` calls all run.
