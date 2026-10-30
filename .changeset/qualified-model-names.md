---
'@pothos/plugin-prisma-next': minor
---

Support models that share a name across namespaces. Reference them as `namespace.Model` (their
default GraphQL type is `namespace_Model`); an ambiguous bare name is now a type error and a schema
build error instead of silently resolving to the first namespace. `collections` also accepts a
namespaced ORM client directly.
