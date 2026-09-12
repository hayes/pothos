---
'@pothos/plugin-scope-auth': minor
---

Apply the implementing type's policy to fields inherited from an interface.

Type level scopes were selected from the type that _declared_ a field, so a field an object
inherited from an interface only ever ran that interface's policy. The implementing object's
`authScopes` and `grantScopes`, and the `authScopes` of the other interfaces it implements, were all
skipped. An object with `authScopes: () => false` still served every field it inherited.

Inherited fields now run the policy of the concrete type they are resolved on _in addition to_ the
policy of the interface that declared the field. Both must pass.

**This can newly deny fields that previously resolved.** Any schema where an object with type level
`authScopes` (or an object implementing a second interface with `authScopes`) inherits fields from
an interface will start returning `null` and a `Not authorized` error for those fields. There is no
opt out flag: the previous behavior disclosed fields the schema's own policy intended to protect, so
this fails closed by default. Fields that should stay readable can set `skipTypeScopes` or
`skipInterfaceScopes` on the interface field, or be redeclared on the object type.

The implementing type's `grantScopes` now also reach inherited fields, which can newly _authorize_
an interface field that uses `$granted`.

Schemas using `runScopesOnType: true` are unaffected — that option already ran the concrete type's
scopes in `isTypeOf`, which covers inherited fields.
