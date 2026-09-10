---
'@pothos/selection-mapper': minor
'@pothos/plugin-prisma': patch
'@pothos/plugin-drizzle': patch
---

The mapper's surface is now what the ORM plugins actually use. The four free entry points are
gone: `planFromInfo` and `rowPlanFromInfo` are the statics `Plan.fromInfo` and
`Plan.forParentRow`, `queryFromPlan` was `plan.query(select)` spelled another way, and
`queryFromInfo` — a rule two of its three consumers had to override — moved into
`@pothos/plugin-prisma`, whose own `queryFromInfo` is unchanged. `entry.ts` dissolved into
`plan.ts`. `hasKeys` moved into prisma's adapter, the only place outside the package that wanted
it, and `EntryOptions`, `Mapping`, `TypeLevelConflict` and `NodeBase` are no longer exported: no
consumer imported them.

Nothing a schema does changes, and the plugins' public API is unaffected.
