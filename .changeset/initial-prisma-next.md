---
"@pothos/plugin-prisma-next": minor
---

Initial 0.1.0 release of `@pothos/plugin-prisma-next` for Prisma ORM 8 (formerly
Prisma Next), targeting exact `8.0.0-rc.9` framework and SQL-family packages.

Derives GraphQL objects, interfaces, variants, relations and field types from
an emitted contract. Resolvers return an unexecuted Collection; the plugin
applies the complete selection and materializes it. Materialized rows are
rejected, and deferred fragments remain in the plan, eliminating fallback loads.

Includes batched Relay node loading, root/related connections, compound cursors
with explicit direction and application scalar codecs, selection-aware counts,
and contract-derived aggregate operations with custom GraphQL scalar support.

Applications own drivers and transactions. The same SQL-family plugin is tested
against SQLite and PostgreSQL, including lossless included values and Temporal
cursors. Mongo's separate family is unsupported. Incompatible to-one refinements
remain an explicit upstream composition limit.

Use Node.js 24 or later. Prisma ORM 8 remains a release candidate; change its exact
pin only with compatibility validation. This package is separate from
`@pothos/plugin-prisma`, which targets the classic `@prisma/client`.
