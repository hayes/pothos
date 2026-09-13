---
'@pothos/plugin-add-graphql': minor
---

Merge an imported schema's root types into matching types the builder already configured.

`add: { schema }` skipped any imported type whose name was already configured, so a schema whose
query root is named `Query` lost every one of its fields when the builder had also called
`queryType()` — no error, and `validateSchema` stayed clean. The same import merged correctly when
the root was declared with `queryFields()`, which registers no type config. Root types of an
imported schema are now merged into the configured type of the same name instead of being dropped,
so both ways of declaring a root behave the same. Fields defined on both sides now raise the
existing `Duplicate field <name> on <Type>` error rather than silently keeping one of them, and
name collisions on types that are not roots of the imported schema still skip, so importing a
shared scalar or re-importing a type stays a no-op.
