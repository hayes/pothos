# Prisma ORM plugin architecture

Production code targets `@prisma/orm-framework` and `@prisma/orm-family-sql`.
It does not construct a SQLite/PostgreSQL client, inspect a dialect, or choose a
driver. Applications supply Collections and own connections and transactions.

## Complete selections

Every supported model field resolves from a complete selection plan.
`prismaField` and `prismaFieldWithInput` require an unexecuted, model-scoped
Collection. The plugin adds the GraphQL selection, waits for async selections,
then calls `.all()`. Singular fields add `.limit(1)`; nullable fields can return
null. Materialized row/array returns are rejected.

There is no general fallback loader. Deferred fragments remain in the initial
plan; GraphQL can defer delivery without a later database fetch. Explicitly
skipping deferred fragments is unsupported.

The shared selection-mapper handles fragments, aliases, variants, prerequisites
and indirect wrapper paths. This plugin compiles its plan to Collection
`select/include/combine` calls. One complete plan need not mean one SQL statement.

## Consumers and normalization

Cached relation metadata records target-model identity and join fields. The
plugin selects parent join columns even when GraphQL did not ask for them.
Prisma resolves N:M junctions from the contract's `through` metadata.

Independent to-many consumers use combine slots. Compatible to-one consumers
merge. RC9 rejects incompatible to-one combinations (`ORM.INCLUDE_UNSUPPORTED`);
the adapter reports this before SQL instead of dropping a consumer.

Combine keys use `:`, forbidden in GraphQL names. Type prerequisites and field
selections have independent namespaces. Immutable overlays route each resolver
to its values without mutating rows shared by aliases/variants. The shared walker
handles errors-plugin indirect result paths.

## Connections

Connections accept an unordered, unpaginated base Collection. Cursor options own
the complete ordering: scalar/compound keys, explicit directions, and reversible
application codecs. Contract validation requires non-null fields containing a
complete primary/unique key. There is no implicit tie-breaker added to cursors.

Prisma orderBy appends and has no public reset. A compatibility helper reads the
pinned Collection state to reject existing ordering/pagination before querying;
it never mutates ORM state. Recheck this seam on every upstream upgrade.

Compatible single-bound pages use native cursor seeking; other bounds use
lexicographic predicates respecting each direction. Overfetch and reversal build
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
