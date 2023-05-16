---
'@pothos/plugin-scope-auth': patch
---

Fix issue where 2nd argument of authScopes on types would actually be the info object when
`treatErrorsAsUnauthorized` was enabled
