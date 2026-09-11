# @pothos/plugin-prisma-next

## 0.1.0

### Minor Changes

- 05942a1: Initial 0.1.0 release of `@pothos/plugin-prisma-next` for Prisma ORM 8 (formerly
  Prisma Next), targeting exact `8.0.0-rc.9` framework and SQL-family packages.

  Derives GraphQL objects, interfaces, variants, relations and field types from
  an emitted contract. Resolvers return an unexecuted Collection; the plugin
  applies the selection plan and materializes it. Materialized rows are
  rejected. An optional context-aware Collection provider enables batched fallback
  loading for deferred selections and incompatible to-one relation consumers.

  Includes batched Relay node loading, root/related connections, compound cursors
  with explicit direction, null placement, and application scalar codecs, selection-aware counts,
  and contract-derived aggregate operations with custom GraphQL scalar support.
  Connections accept existing ordering that matches a prefix of the cursor's query
  order, including the reversed order used for backward pages.

  Applications own drivers and transactions. The same SQL-family plugin is tested
  against SQLite and PostgreSQL, including lossless included values and Temporal
  cursors. Mongo's separate family is unsupported. Without a fallback Collection
  provider, deferred selections load eagerly and incompatible to-one refinements
  are rejected.

  Use Node.js 24 or later. Prisma ORM 8 remains a release candidate; change its exact
  pin only with compatibility validation. This package is separate from
  `@pothos/plugin-prisma`, which targets the classic `@prisma/client`.

### Patch Changes

- Updated dependencies [0c7565a]
- Updated dependencies [1358f71]
  - @pothos/core@4.14.0
  - @pothos/selection-mapper@0.1.0

## 0.1.0 (unpublished)

Initial fork from `@pothos/plugin-drizzle` and conversion to prisma-next. See README.md for status.
