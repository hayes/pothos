---
"@pothos/core": patch
---

- Compute recursive input mapping reachability to a fixed point so mapped fields reachable only through a cycle are no longer pruned
- Normalize refs (and promises of refs) returned from an interface `resolveType` to type names, as the union path already did
- Type the fourth argument of an interface `resolveType` callback as `GraphQLInterfaceType` instead of `GraphQLUnionType`
- Honor the `name` option when implementing an interface ref
- Keep heterogeneous TypeScript enum members whose string value happens to name a numeric member
- Omit arguments removed by `onInputFieldConfig` from the `config.args` passed to resolver wrappers
- Preserve `specifiedByURL` on imported scalars, and accept it as a `scalarType` option
- Make the no-`Buffer` `encodeBase64`/`decodeBase64` fallback UTF-8 safe
