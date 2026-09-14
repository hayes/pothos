# @pothos/plugin-prisma-next

## 0.1.2

### Patch Changes

- 138b2ea: Match binary node IDs by their byte content so distinct Buffer IDs load the correct records and Uint8Array IDs round trip through node lookups. Preserve custom ID parser and resolver matching.

## 0.1.1

### Patch Changes

- 8178e96: Narrow resolver parent types for `prismaObjectField`, `prismaObjectFields`,
  `prismaInterfaceField`, and `prismaInterfaceFields` when called with a model-name string. Parents
  now include only declared selections instead of every model column. Ref-based calls are unchanged.
  `prismaNode` parents likewise reflect its `select`; custom `id.resolve` callbacks also receive the
  single or compound columns named by `id.field`.

  Field-level selections remain additive, and `t.expose*`, `t.relation`, and selection-key validation
  are unchanged. Runtime loading is unchanged. To supply the full row type explicitly, use
  `builder.prismaObjectField<'User', Row<Types, 'User'>>('User', …)`.

- 15ae360: Infer connection node types from `prismaConnectionHelpers.resolveNode`. With a custom
  `resolveNode`, `wrap` now requires full model rows and returns the callback's output type. Passing
  narrowed rows to such a helper is now a type error.

  A conditional `resolveNode` produces a union of its output and the original row. Helpers without
  `resolveNode` still infer nodes from the rows passed to `wrap`. The new fourth type parameter on
  `PrismaConnectionHelpers` is optional, so existing type references remain valid.

  Runtime behavior is unchanged; cursors still use the original rows.

- a5eb463: Type an optional `prismaFieldWithInput` input as possibly `undefined`, matching the omitted-arg value GraphQL passes to the resolver
  Correct the cross-file field helper docs: extend a variant with its ref, not its variant-name string
  Preserve interface selections on inherited fields, using the declaring interface's selection aliases
  and the owning type's model for fallback loading.
- Updated dependencies [da938c5]
  - @pothos/core@4.15.0
  - @pothos/selection-mapper@0.1.0

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
