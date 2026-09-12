---
"@pothos/plugin-add-graphql": patch
---

Use the operation roles declared by an imported schema instead of inferring them from type names: roots with custom names (`schema { query: Root }`) are imported as operation roots, types that the imported schema does not use as a root are no longer promoted to one because they are named `Query`, `Mutation` or `Subscription`, and an operation root the builder already defines is never re-declared. `builder.addGraphQLObject` accepts a new `rootKind` option to select the operation root a type is imported as, or `null` to import a type named `Query`, `Mutation` or `Subscription` as a normal object type; types imported without a `rootKind` (`add: { types }` and standalone `addGraphQLObject` calls) still infer roots from their names, and an imported schema that declares no query root still falls back to a type named `Query`. Also preserve `deprecationReason` on imported input object fields
