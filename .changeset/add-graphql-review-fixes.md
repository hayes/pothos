---
"@pothos/plugin-add-graphql": patch
---

Use the operation roles declared by an imported schema, including custom root names. Types named
`Query`, `Mutation`, or `Subscription` are no longer promoted to roots unless the schema uses them
for that operation. Existing builder roots are preserved, and an imported root is not reused for
a second operation. Schemas without a query root still fall back to a type named `Query`.

Add `rootKind` to `builder.addGraphQLObject`: choose an operation root or pass `null` to import a
regular object. Standalone imports and `add: { types }` continue to infer roots from names when
`rootKind` is omitted.

Preserve `deprecationReason` on imported input fields.

Merge fields from imported schema roots into configured types with the same name, retaining the
configured type's description, extensions, and AST metadata. Configured fields take precedence over
same-named imported fields, and non-overlapping imported fields are retained. Explicit
`addGraphQLObject` field overrides and removals are preserved. Merged fields use the destination's
field kind, so root-field plugins apply. Non-root collisions and `add: { types }` behavior are
unchanged, and repeated schema builds do not merge the same root again.

Duplicate local field declarations and collisions through `queryFields()` without a configured
root keep their existing errors. Root collisions with non-object types or different operation
roots now throw, including on subsequent builds.
