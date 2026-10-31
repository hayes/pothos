# Prisma Next plugin architecture

Production code depends on `@prisma/orm-framework` and `@prisma/orm-family-sql` (pinned to
`8.0.0-rc.22`). It never constructs a client, inspects a dialect, or chooses a driver; applications
pass their client (or a per-request client such as a transaction) and own connections and
transactions. Concrete drivers appear only in tests and
examples.

## Selection planning

- `prismaField` / `prismaFieldWithInput` require an unexecuted Collection. Their resolver applies
  the plan from the shared selection mapper as `select` / `include` / `combine` calls, awaits async
  selections, then calls `.all()` (with `.limit(1)` for singular fields). Materialized returns are
  rejected.
- The adapter is a `NodeAdapter`: field and type selections normalize to one query shape (columns,
  relations, computed values), and merges, comparisons and conflicts are the mapper's. Join
  columns come from the ORM, which adds hidden ones when `select()` narrows. N:M relations resolve
  through the contract's `through` metadata.
- A to-one relation is keyed by its name: the ORM includes it once (`combine` is to-many only,
  `ORM.INCLUDE_UNSUPPORTED`), so its consumers merge or conflict, and a conflicting field loads
  through the loader. Function-form to-one selections are always rejected.
- A to-many relation is keyed by consumer scope: the type and alias of the field (and of the fields
  above it), or the type for a type-level `select`. A relation whose consumers agree is one
  include; otherwise each scope is one `combine` slot, so different arguments still load in one
  statement. When a statement's rows come back, the slots are taken off each row and kept beside
  it; a row whose slots belong to one type keeps that type's rows and computed values.
- Every reader gets a view of the row: its columns, plus the rows and values its scopes loaded,
  later scopes winning. `isTypeOf` and `resolveType` get their type's view (its interfaces'
  `select`s, then its own). Every plugin around a field gets the parent the field declares (its
  type's view plus the field's own `select`), through `wrapArgMappers`, which wraps every plugin's
  `wrapResolve` whatever their order; a reload stays in this plugin's `wrapResolve`, so plugins
  listed before it run before the reload. A field helper's resolver (`t.relation`, counts,
  aggregates, connections) also reads its own slots. Views are cached per row and scopes, so
  per-row caches (scope-auth) see one parent, and slot objects are never visible.
- An interface loads its implementations' type-level selections too, since their `isTypeOf` reads
  rows loaded as the interface: to-many relations and computed values in their own slots, and
  to-one relations merged, so implementations selecting one differently fail the schema build.
  Each build's interfaces carry their own registry of implementations.
- Relation queries compare by what identifies them (a declarative query, or the defining field
  with its arguments for a callback, which builds a new closure per walk). Matching aliases alone
  never establish compatibility.

## Fallback loader

Loads through `prismaNext.client`'s `orm`. Unmapped fields compile a `Plan.forParentRow` with their
dependencies and compatible type prerequisites. Compatible plans share a batch; each batch queries
all parent identities (`IN` or compound `OR`) and fans rows back by identity. `node(id:)` lookups
use the same loader, batched per type and path. Per-row/path
mappings keep one fallback result from claiming another parent's coverage.

- Identities are a non-null primary or unique key, selected automatically, and compared by the
  column codec's stored form and its data type's `equalityKey` (decimals `0.5` and `0.50` match).
- Loader Collections must be unpaginated. Missing identities, excluded rows and missing
  collections fail only the affected fields. An error building or running a batch's statement,
  such as a user callback throwing, fails every field in the batch, as it fails a parent query.
- Fields a row already satisfies skip the loader, so hand-built and deleted rows resolve.
- Deferred fragments are skipped by default and loaded on execution.

## Connections

- Base Collections must be unpaginated and not `distinct`. Cursors describe the full ordering
  (directions, null placement) and must contain a complete non-null unique key; no
  tie-breaker is added implicitly.
- Prisma's `orderBy` appends with no public reset, so an existing ordering must be a prefix of the
  query order for the requested direction; missing entries are appended. The state is read, never
  mutated.
- Pages always seek with lexicographic keyset predicates with explicit null handling. Cursor and
  node ID values are held in their column codec's stored form, in the shared tagged encoding
  from core.
- Related connections paginate inside the include. Counts use the filtered, pre-pagination
  Collection and only run when selected.

## Nodes, aggregates, inheritance, namespaces

- Node loads go through the fallback loader and brand rows for abstract resolution. Concrete
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
- `src/utils/config.ts` reads a collection's `@internal` `ctx.context` for the codecs of a
  per-request client that doesn't expose `context`, such as a transaction.
- Test fixture generators map the `@internal/*` specifiers the emitter leaves in declarations.

When the pin changes, regenerate the fixtures and rerun the integration tests.

## Database coverage

- SQLite and PostgreSQL run the full suite. PostgreSQL covers lossless values, Temporal cursors
  and transactions. `postgresServerless()` is tested against a local server only.
- MySQL 8.4 reads are tested when `POTHOS_PRISMA_NEXT_MYSQL_URL` is set (not in CI). Its contracts
  declare no aggregates, so count options are compile errors (with a runtime error for untyped
  callers), and ORM writes need `returning`.
- MongoDB is rejected at schema build: on rc.22 its Collections have no `combine`, cursor or
  aggregates, and silently ignore include refinements and `where` callbacks.

## Testing

PostgreSQL runs on port 5456 (database `prisma_next`, user and password `prisma`) or
`POTHOS_PRISMA_NEXT_DATABASE_URL`. MySQL tests skip unless `POTHOS_PRISMA_NEXT_MYSQL_URL` is set;
CI doesn't provision MySQL.

```sh
pnpm --filter @pothos/plugin-prisma-next... build
pnpm --filter @pothos/plugin-prisma-next type
pnpm --filter @pothos/plugin-prisma-next test
```

Type checking includes an isolated scope-auth project so its global option augmentation doesn't
leak into other tests.
