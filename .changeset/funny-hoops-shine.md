---
"@pothos/plugin-drizzle": minor
---

Add new field builder methods and connection enhancements:

- `t.relatedField`: New method for creating custom fields based on relations with custom selections using the `buildFilter` callback
- `t.relatedCount`: Simplified method for counting related records, with optional `where` filter support
- `totalCount: true` option for `relatedConnection`: Adds a `totalCount` field to related connections
- `totalCount` callback for `drizzleConnection`: Allows adding a `totalCount` field to drizzle connections
- `totalCountOnly` optimization: Skips the main query when only `totalCount` is requested (for both connection types)
