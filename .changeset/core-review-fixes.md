---
"@pothos/core": minor
---

- Compute recursive input mapping reachability to a fixed point so mapped fields reachable only through a cycle are no longer pruned
- Correct the input and output types on the ref returned by `scalarType`, which were swapped relative to the scalar's `Input`/`Output` shapes
- Normalize refs (and promises of refs) returned from an interface `resolveType` to type names, as the union path already did
- Type the fourth argument of an interface `resolveType` callback as `GraphQLInterfaceType` instead of `GraphQLUnionType`
- Honor the `name` option when implementing an interface ref
- Keep heterogeneous TypeScript enum members whose string value happens to name a numeric member
- Omit arguments removed by `onInputFieldConfig` from the `config.args` passed to resolver wrappers
- Preserve `specifiedByURL` on imported scalars, and accept it as a `scalarType` option. **This changes the printed schema and introspection**: a scalar imported with `addScalarType` that carries a specification URL (many `graphql-scalars` exports do, such as `EmailAddressResolver`) now prints as `scalar EmailAddress @specifiedBy(url: "…")` and reports that URL through introspection, where both were previously absent. Expect SDL snapshot tests and schema-diff checks to register the addition.
- Make the no-`Buffer` `encodeBase64`/`decodeBase64` fallback UTF-8 safe, including preserving a leading BOM
