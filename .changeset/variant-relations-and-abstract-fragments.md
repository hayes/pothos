---
'@pothos/selection-mapper': patch
'@pothos/plugin-prisma-next': patch
---

Walk a fragment on an abstract type without a model (`... on Node`) beneath a model interface as each implementation it contains, instead of dropping its fields. `Plan.forParentRow` accepts an initial selection.

Fix native inheritance in the Prisma ORM 8 plugin: relations declared on a variant load from `orm.Base.variant(value)` collections, relations typed as a variant (`t.relation('tasks', { type: bug })`, `t.relatedConnection`) are narrowed to it, relations targeting a single-table variant model filter by discriminator, the default `resolveType` routes to custom-named variant types (and the build fails when a variant has no or several implementations), qualified `prismaNode` models load through `node(id:)`, and inherited fields beneath an interface list no longer reload through the provider. Node IDs are no longer encoded from rows missing their id fields.
