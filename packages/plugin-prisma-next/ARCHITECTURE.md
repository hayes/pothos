# Prisma ORM plugin architecture

Production code targets `@prisma/orm-framework` and `@prisma/orm-family-sql`.
It does not construct a SQLite/PostgreSQL client, inspect a dialect, or choose a
driver. Applications supply Collections and own connections and transactions.

## Selection planning and loading

Every supported model field resolves from a selection-aware query.
`prismaField` and `prismaFieldWithInput` require an unexecuted, model-scoped
Collection. The plugin adds the GraphQL selection, waits for async selections,
then calls `.all()`. Singular fields add `.limit(1)`; nullable fields can return
null. Materialized row/array returns are rejected.

A configured `prismaNext.collections` provider enables a request-local model
loader, following the Prisma and Drizzle plugins. The shared mapper records which
fields an eager plan accepted. Unmapped fields compile a `Plan.forParentRow`,
including their dependencies and compatible type prerequisites. Compatible plans
merge into one batch; incompatible refinements get separate batches. Each batch
queries all parent identities using `IN` or compound `OR` predicates and fans rows
back by tagged identity. Per-row/path mappings prevent one fallback result from
claiming another parent's selection coverage.

Fields without declared dependencies resolve directly. Loaded scalar fields keep
their original parent identity; overlays are only used where selection routing
requires them.

Provider-enabled planning selects a non-null primary or unique key on model rows.
Providers supply unpaginated model Collections, preserving application filters
and transaction bindings. Missing identities, excluded rows, missing providers,
and batch errors reject the affected fields. Scalar, Date, bytes, and Decimal
identity values are supported; opaque object identities are rejected pending an upstream public stable-row-identity
or input-mapped bulk lookup primitive.

With a provider, deferred fragments are omitted by default and load when GraphQL
executes them. `skipDeferredFragments: false` keeps eager loading. Without a
provider, deferred fields remain in the initial plan and explicit skipping is
rejected. Incremental execution must register the `@defer` directive and keep
any transaction alive through consumption of subsequent results.

The shared selection-mapper handles fragments, aliases, variants, prerequisites
and indirect wrapper paths. This plugin compiles its plan to Collection
`select/include/combine` calls. One complete plan need not mean one SQL statement.

## Consumers and normalization

Cached relation metadata records target-model identity and join fields. The
plugin selects parent join columns even when GraphQL did not ask for them.
Prisma resolves N:M junctions from the contract's `through` metadata.

Independent to-many consumers use combine slots. Compatible to-one consumers
merge. RC9 rejects incompatible to-one combinations (`ORM.INCLUDE_UNSUPPORTED`).
With a provider, compatibility checks leave conflicting consumers for separate
multi-parent loads; without a provider the adapter rejects the plan before SQL.

Combine keys use `:`, forbidden in GraphQL names. Type prerequisites and field
selections have independent namespaces. Immutable overlays route each resolver
to its values without mutating rows shared by aliases/variants. The shared walker
handles errors-plugin indirect result paths.

## Connections

Connections accept an unpaginated base Collection. Cursor options describe the
complete ordering: scalar/compound keys, explicit directions, null placement,
and reversible application codecs. Nullable sort fields default to nulls last;
the cursor must still contain a complete non-null primary/unique key. There is
no implicit tie-breaker added to cursors.

Prisma orderBy appends and has no public reset. A compatibility helper reads the
pinned Collection state to reject pagination and check existing ordering before
querying. Existing ordering must match a prefix of the cursor's query order;
missing ordering entries are appended. Backward pages require reversed ordering,
so an unordered base works for both directions. The helper never mutates ORM
state. Recheck this seam on every upstream upgrade.

Compatible single-bound pages with non-null keys use native cursor seeking;
other bounds use lexicographic predicates respecting each direction and null
placement. Nullable ordering uses shared ORM null-check expressions, without
depending on a database's default null order. Overfetch and reversal build
Relay pages. Shared core encoding preserves built-in scalar types; explicit
codecs restore objects such as Temporal without dialect-specific code.

Related connections paginate inside the include plan. Counts use the filtered,
pre-pagination Collection/relation. Count-only selections avoid loading page rows;
unselected counts are not executed. All execution uses the supplied client and
must remain within its transaction lifetime.

## Nodes and aggregates

Node loads batch per request, GraphQL type and path, apply selections, and route
results by ID. Loader rows are branded for abstract resolution. Concrete node
fields do not install a brand-only isTypeOf; custom predicates are respected.
Compound IDs use tagged values and optional per-field application codecs.

Aggregate operations/fields/results derive from emitted AggregateTypes. Count
defaults to Int and other numeric operations to Float. Non-number results require
an explicit compatible GraphQL type. Function-form selections remain available
for custom projections, including lossless/custom aggregate operations.

## Verification and limits

SQLite and PostgreSQL tests exercise the same plugin. PostgreSQL covers lossless
included values, Temporal cursors and transactions. Type tests cover returns,
nullability and aggregate types. Incremental execution and scope-auth have runtime
coverage. See [release status](./docs/release-status.md).

MongoDB requires its own real adapter: its contract/Collection family differs
from SQL. The shared GraphQL walker is reusable, but widening SQL types cannot
supply missing Mongo operations. Bare model names must be unique across contract
namespaces; Pothos variants do not imply native ORM inheritance support.
