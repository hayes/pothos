---
'@pothos/core': minor
'@pothos/plugin-complexity': minor
'@pothos/plugin-sub-graph': minor
'@pothos/converter': minor
---

Support graphql 17 alongside graphql 16. Peer dependency ranges now accept `^16.10.0 || ^17.0.0`,
and the library source compiles against both majors. graphql 17 changed a handful of types that
Pothos touches: `GraphQLNonNull<T>` is now constrained to nullable types, `GraphQLResolveInfo['variableValues']`
became `{ sources, coerced }` (consumed by the complexity plugin via `getArgumentValues`), and
`GraphQLArgument` is no longer assignable to `GraphQLField`. Each is handled in a version-agnostic
way, with a runtime version branch only where the `variableValues` shape genuinely differs.
