# Prisma Next plugin architecture

Production code depends on `@prisma/orm-framework` and `@prisma/orm-family-sql` (pinned to
`8.0.0-rc.22`). It never constructs a client, inspects a dialect, or chooses a driver; applications
supply Collections and own connections and transactions. Concrete drivers appear only in tests and
examples.

## Selection planning

- `prismaField` / `prismaFieldWithInput` require an unexecuted Collection. The plugin applies the
  plan from the shared selection mapper as `select` / `include` / `combine` calls, awaits async
  selections, then calls `.all()` (with `.limit(1)` for singular fields). Materialized returns are
  rejected.
- Parent join columns are always selected. N:M relations resolve through the contract's `through`
  metadata.
- Independent to-many consumers get their own `combine` slots. Combine keys use `:` (invalid in
  GraphQL names); type prerequisites and field selections have separate namespaces. Immutable
  overlays route each resolver to its values without mutating shared rows.
- Compatible to-one consumers merge. Prisma rejects `combine` on to-one includes
  (`ORM.INCLUDE_UNSUPPORTED`), so incompatible ones go to the loader, or are rejected before SQL
  without a provider. Function-form to-one selections are always rejected.
- Same-source consumers with equal bound arguments are one branch (callback `query` builds a new
  closure per walk). Matching aliases alone don't establish compatibility.

## Fallback loader

Enabled by `prismaNext.collections`. Unmapped fields compile a `Plan.forParentRow` with their
dependencies and compatible type prerequisites. Compatible plans share a batch; each batch queries
all parent identities (`IN` or compound `OR`) and fans rows back by tagged identity. Per-row/path
mappings keep one fallback result from claiming another parent's coverage.

- Identities are a non-null primary or unique key, selected automatically. Scalar, Date, bytes and
  Decimal values work directly; other objects go through column codecs (`prismaNext.context`) or a
  string `toJSON()`.
- Provider Collections must be unpaginated. Missing identities, excluded rows, missing providers
  and batch errors fail only the affected fields.
- Fields a row already satisfies skip the loader, so hand-built and deleted rows resolve.
- Deferred fragments are skipped by default with a provider and loaded on execution.

## Connections

- Base Collections must be unpaginated and not `distinct`. Cursors describe the full ordering
  (directions, null placement, codecs) and must contain a complete non-null unique key; no
  tie-breaker is added implicitly.
- Prisma's `orderBy` appends with no public reset, so an existing ordering must be a prefix of the
  query order for the requested direction; missing entries are appended. The state is read, never
  mutated.
- Single-bound pages over non-null keys use native cursor seeking; others use lexicographic
  predicates with explicit null handling. Values use the shared tagged encoding from core.
- Related connections paginate inside the include. Counts use the filtered, pre-pagination
  Collection and only run when selected.

## Nodes, aggregates, inheritance, namespaces

- Node loads batch per request, type and path, and brand rows for abstract resolution. Concrete
  types don't get a brand-only `isTypeOf`. Cursor validation and identity selection share one
  unique-key helper.
- Aggregate operations, fields and result types derive from the contract's `AggregateTypes`.
- A native inheritance hierarchy shares one planner model. Interfaces select the discriminator;
  variant returns must be `orm.Base.variant(value)`. Pothos variants remain same-model views.
- Model keys are bare when unique and `ns.Model` otherwise, resolved in `src/utils/contract.ts`.

## Upstream internals

Recheck these on every Prisma upgrade:

- `src/types.ts` rebuilds include-refinement types Prisma doesn't export.
- `src/utils/collection-state.ts` reads the `@internal` Collection `state.orderBy`, `limit`,
  `offset`, `cursor`, `distinct` and `distinctOn` to validate connection bases, since there is no
  public accessor or `orderBy` reset.
- `src/utils/contract.ts` reads the `@internal` `state.variantValue` to require
  `orm.Base.variant(value)` for variant returns.
- Test fixture generators map the `@internal/*` specifiers the emitter leaves in declarations.

When the pin changes, regenerate the fixtures and rerun the integration tests.

## Database coverage

- SQLite and PostgreSQL run the full suite. PostgreSQL covers lossless values, Temporal cursors
  and transactions. `postgresServerless()` is tested against a local server only.
- MySQL 8.4 runs reads in CI. Its contracts declare no aggregates, so count options are compile
  errors (with a runtime error for untyped callers), and ORM writes need `returning`.
- MongoDB is rejected at schema build: on rc.22 its Collections have no `combine`, cursor or
  aggregates, and silently ignore include refinements and `where` callbacks.

## Testing

PostgreSQL runs on port 5456 (database `prisma_next`, user and password `prisma`) or
`POTHOS_PRISMA_NEXT_DATABASE_URL`. Set `POTHOS_PRISMA_NEXT_MYSQL_URL` for MySQL. `node.js.yml`
provisions both.

```sh
pnpm --filter @pothos/plugin-prisma-next... build
pnpm --filter @pothos/plugin-prisma-next type
pnpm --filter @pothos/plugin-prisma-next test
```

Type checking includes an isolated scope-auth project so its global option augmentation doesn't
leak into other tests.
