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
