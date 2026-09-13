---
'@pothos/plugin-add-graphql': patch
---

Merge the root types of a schema imported with `add: { schema }` into matching types the builder
already configured.

`add: { schema }` skipped any imported type whose name was already configured, so a schema whose
query root is named `Query` lost every one of its fields when the builder had also called
`queryType()` — no error, and `validateSchema` stayed clean. The same import merged correctly when
the root was declared with `queryFields()`, which registers no type config. The fields of an
imported schema's roots are now merged into the configured type of the same name instead of being
dropped, so both ways of declaring a root end up with the same fields. Only fields are merged: the
`description`, `extensions` and `astNode` of the imported root are still left to the type the
builder configured, so the two ways of declaring a root are not otherwise identical. Name
collisions on types that are not roots of the imported schema still skip, so importing a shared
scalar or re-importing a type stays a no-op, and types passed to `add: { types }` are unchanged —
nothing there is treated as the root of an imported schema. Building the same builder more than
once is also unchanged: a root is merged once per builder rather than once per build.

Merged root fields are registered with the root kind of the type they are merged into rather than
as object fields, so plugins that only act on root fields — the complexity plugin's depth and
breadth limits — now apply to them as well.

This can break a build that currently succeeds. A field declared both on the builder's root and on
the colliding imported root now raises the existing `Duplicate field <name> on <Type>` error
instead of silently keeping the builder's version and dropping the imported one. An imported root
whose name collides with a type that is not an object now reports `Can not merge the imported root
<name> into the <kind> type the builder defines with the same name` rather than being dropped.
