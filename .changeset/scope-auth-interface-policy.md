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

`skipInterfaceScopes` opts out of the declaring interface's check on an inherited field, following
the same rule it already follows for a field declared on an object that implements interfaces:
either the field option or the object type's option suppresses it. The concrete type's own
`authScopes` still runs — `skipInterfaceScopes` never suppresses that. The declaring interface's
`grantScopes` also still runs, since skipping it would newly deny interface fields that use
`$granted`.

`skipTypeScopes` on an interface field continues to skip the declaring interface's `authScopes` and
now also skips the concrete type's. A check skipped by either flag cannot come back through the
concrete type's list of implemented interfaces.

Two parts of this change can newly _authorize_ a field instead of denying it:

- The implementing type's `grantScopes` now reach inherited fields, so an interface field using
  `$granted` can start passing because the concrete type grants the scope.
- `skipInterfaceScopes` on an interface field now suppresses the declaring interface's own
  `authScopes`, which it could not reach before. A field carrying that flag under an interface with
  `authScopes` was denied and now resolves.

`runScopesOnType: true` set on an object type or globally is unaffected: that option already ran the
concrete type's scopes in `isTypeOf`, which covers inherited fields. Set on an _interface_ it is
affected — the interface's scopes are moved off its own fields, and because an interface has no
`isTypeOf` they previously ran nowhere for inherited fields while still denying the implementing
type's own fields. They are now enforced through the implementing type's interface list, so a field
inherited from such an interface can newly deny.
