---
'@pothos/core': minor
'@pothos/plugin-complexity': minor
'@pothos/plugin-sub-graph': minor
'@pothos/converter': minor
'@pothos/test-utils': minor
---

Support graphql 17 alongside graphql 16. Peer dependency ranges now accept `^16.10.0 || ^17.0.0`,
and the library source compiles against both majors. graphql 17 changed a handful of types that
Pothos touches: `GraphQLNonNull<T>` is now constrained to nullable types, `GraphQLResolveInfo['variableValues']`
became `{ sources, coerced }` (consumed by the complexity plugin via `getArgumentValues`), and
`GraphQLArgument` is no longer assignable to `GraphQLField`. Each is handled in a version-agnostic
way, with a runtime version branch only where the `variableValues` shape genuinely differs.

graphql 17 also moved incremental delivery (`@defer`/`@stream`) out of the stable `execute`, which
now throws on any schema that declares those directives. `@pothos/test-utils` gains a version-aware
`execute` helper that routes through `experimentalExecuteIncrementally` on 17 and collapses the
incremental payloads back into a single result, so defer/stream-aware query planning in the prisma
and drizzle plugins is validated identically on both majors.

`scalarType` now accepts graphql 17's modern coercion hooks — `coerceOutputValue`, `coerceInputValue`,
`coerceInputLiteral`, and `valueToLiteral` — alongside the existing `serialize`/`parseValue`/`parseLiteral`.
These are consulted only on graphql 17+ (graphql 16 continues to use `serialize`/`parseValue`/`parseLiteral`);
per graphql's constructor, `coerceInputLiteral` must be paired with `coerceInputValue`. `serialize` is
now optional when `coerceOutputValue` is provided instead (one of the two is required for output).
