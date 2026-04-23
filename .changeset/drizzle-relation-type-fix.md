---
"@pothos/plugin-drizzle": patch
---

Fix broken types in `query` argument of `drizzleField`, `drizzleConnection`,
`t.relation`, and related connections after the drizzle-orm 1.0.0-beta.10
update. The plugin was still referring to the removed `$relationBrand` and
`targetTable['_']['name']` properties on `Relation`, which caused the query
filter/option types to collapse to `any`.
