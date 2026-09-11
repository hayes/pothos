# Initial 0.1.0 release status

This implementation combines eager selection planning with optional multi-row
fallback loading. Pothos has no SQLite/PostgreSQL-specific behavior.
Production dependencies are the Prisma ORM 8 framework and SQL family, pinned
to 8.0.0-rc.9. Concrete drivers appear only in tests and application examples.

## Review findings and disposition

| Finding | Disposition / evidence |
|---|---|
| Old Prisma Next dependencies | Migrated imports, dependencies, runtime hooks and emitted contracts to ORM 8 RC9 |
| Removed take/skip APIs | Replaced with limit/offset in Collection emission and public relation options |
| Async public selection helpers | Return MaybePromise rather than hiding a runtime promise; negative type regression |
| Packed declaration imports | Public helper options survive declaration stripping; strict ESM/CJS consumer checks |
| Contract-derived aggregates | Operations/fields/results derive from AggregateTypes; type tests cover lossless operations, field counts, text min and required scalar choices |
| Fractional aggregates incorrectly use Int | Numeric non-count reducers default to Float; explicit output scalar supported; SQLite/PostgreSQL regressions |
| Raw rows bypass selection application | Root/with-input return types require Collections (or nullable null); runtime rejects bypasses |
| Deferred fragments omitted | A configured Collection provider enables batched deferred loading; incremental tests verify initial SQL omits deferred-only data and one later batch loads it. Eager mode remains supported |
| Conflicting to-one refinements | Compatible groups preload; provider-backed multi-parent loads service remaining branches, preserving aliases, nulls, nested mappings and transactions |
| Default node isTypeOf rejects normal rows | Removed brand-only concrete predicate; preserve explicit user predicate and node-loader brands |
| ID-only node selection misses ID columns | Node ID field declares its selected columns; regression for direct concrete node access |
| Errors-wrapped root lists materialize one row | Original list shape is retained in prepared field metadata; errors-wrapper regression |
| Mixed-null composite FK inference | Existential nullable-field check; type regression |
| Declarative relation select parent types | Resolver parents include filtered to-one and to-many relations; object/field type regressions |
| Mutation result behavior | Real PostgreSQL GraphQL create/update, serial with-input results, transaction-bound fallback batches, rollback, and expired-transaction coverage |
| Remaining selection conflicts | Field overrides and separate variant prerequisites retain independent results in multi-parent batches; inherited incompatible prerequisites and function-form to-one selections fail clearly before SQL |
| Existing ordering breaks page two | Compatible preordered prefixes are accepted and completed; incompatible ordering and paginated bases are rejected before SQL |
| Descending/mixed cursors | Explicit per-field direction, forward/backward/both-bound runtime coverage |
| Nonunique/nullable cursors | Nullable sort fields support explicit null placement with a full non-null unique tie-breaker; SQLite/PostgreSQL traversal and related-page tests |
| Temporal/other scalar cursors | Application codecs, no dialect detection; real PostgreSQL Temporal round-trip |
| Composite bigint/Date node IDs | Shared tagged encoding plus per-column codecs; custom parser formats preserved |
| Count-only queries load rows | Root and related count-only plans avoid row loading |
| Helper eagerly executes count | Lazy cached selection-aware count promise |
| SQLite-only validation | Added PostgreSQL 18 service and runtime tests for included precision, aggregates, cursors and transaction rollback |
| Scope-auth coverage | Runtime allow/deny cases including zero SQL for denied root; isolated type project for ambient plugin augmentation |
| Namespace typing | Nondefault namespace type regression; bare names must remain globally unique |
| Stale docs/release metadata | Refreshed API/architecture/upstream notes; version staged at 0.0.0 so the initial minor changeset emits 0.1.0 |

## Deliberate initial-release boundaries

- **MongoDB:** unsupported. Its Collection/contract family cannot execute the SQL
  adapter's refinement/combine operations. Shared GraphQL planning is reusable,
  but a real Mongo implementation and tests are required.
- **Fallback configuration:** requires application-supplied unpaginated model
  Collections and non-null primary/unique identities. Opaque object identities
  remain unsupported pending an upstream public identity or input-mapped bulk
  lookup primitive; scalar/Date/bytes/Decimal keys work.
  Without a provider, incompatible to-one refinements are rejected before SQL.
  Separate variant fields can load different prerequisites in batches. Conflicting
  prerequisites on an object and its implemented interface are rejected before SQL;
  move the differing filters to fields. Function-form to-one selections remain
  unsupported by the public combine API; use declarative selects or relation fields.
- **Native ORM inheritance and duplicate namespace model names:** not exposed as
  dedicated Pothos concepts. GraphQL variants are same-model views. A qualified
  model identity and inheritance-specific contract design need separate work.
- **Preordered connections:** existing ordering must match the requested page's
  query direction. Prisma has no public ordering reset, so a forward-ordered
  Collection cannot also serve backward pages. Unordered Collections work in
  both directions. Nullable sort fields still require a non-null unique tie-breaker.
- **Additional/serverless drivers:** no validation claim beyond the tested SQL
  runtimes. No dialect-specific code prevents other compatible drivers, but
  matching types alone is not runtime certification.
- **GraphQL input generation:** no equivalent of the separate Prisma-utils
  companion plugin. Standard Pothos inputs and with-input remain available.
- **Descriptions and native subscriptions:** explicit descriptions work; no new
  automatic contract-comment or database-change-stream mapping is claimed.

Applications retain native ORM access for mutations, grouped queries, custom
extensions and transaction policy. Pothos aggregate/scalar interfaces preserve
contract-derived extensibility rather than enumerate database capabilities.

## Upstream compatibility debt

Include-refinement helper types remain internal upstream and are reconstructed
from public Collection/aggregate types. Connection and fallback pagination validation read the pinned
Collection state because orderBy appends and has no public reset API. These are
centralized compatibility seams, not database-dialect checks.

RC9's programmatic fixture emitter leaves internal declaration imports and omits
structural defaults required by its deserializer. Fixture generation/loading
corrects those mismatches; production plugin code does not patch a database
runtime. Regenerate fixtures and rerun integration tests when changing the pin.

## Verification

Run the PostgreSQL service on port 5456 with database/user/password
`prisma_next` / `prisma` / `prisma`, or set `POTHOS_PRISMA_NEXT_DATABASE_URL`.
The CI workflow provisions this separately from the older sibling-plugin database.

```sh
pnpm --filter @pothos/plugin-prisma-next... build
pnpm --filter @pothos/plugin-prisma-next type
pnpm --filter @pothos/plugin-prisma-next test
pnpm exec biome check packages/plugin-prisma-next
```

Type checking includes the ordinary test/source project and an isolated
scope-auth project. The isolation prevents that optional plugin's global option
augmentation from requiring auth configuration in every unrelated test.
Generated contracts are checked in alongside regeneration scripts and source PSL.

The PR also verifies packed-package imports and declarations from a separate
consumer project; the final PR description records exact results and limitations.


Packed consumers were checked with TypeScript 5.9.3, including full dependency
checking in ESM and CommonJS projects using both SQL facades. Strict declaration
checking requires the optional Relay/with-input type peers and Temporal globals
where applicable; runtime imports do not require those optional plugins. The
consumer also executes an actual SQLite GraphQL query on Node 24.15.0.


The pre-loader integration run passed 33 test files / 318 tests, both type projects,
and all 113 monorepo build/generate/type/test tasks. The loader additions have
separate multi-row, compound-key, deferred, transaction, wrapper, and type coverage. The root Biome
command encountered an unrelated nested worktree configuration; checking all
Git-tracked files explicitly passed. A release simulation produced public 0.1.0
with core peer ^4.14.0, without modifying this checkout's release versions.

The loader update passes the plugin build, both type projects, all 36 test files /
341 tests, and Biome checks of every changed TypeScript file. This includes real
SQLite query-count assertions and PostgreSQL transaction rollback coverage.
Review regressions verify that dependency-free fields need no identity or query,
preloaded scalar parents retain object identity, and inherited type prerequisites
still load. Connection and fallback pagination checks share one state inspection.

The connection update passes all 38 test files / 365 tests against SQLite and
PostgreSQL 18.2, both type projects, the plugin build, and Biome checks of all
changed TypeScript files. Independent standards and behavior reviews found no
actionable issues. Coverage includes nullable boundaries in both directions,
compatible preordered prefixes, count-only validation, and nullable codec types.

The mutation/selection-conflict update passes all 40 test files / 376 tests,
both type projects, the plugin build, and changed-file Biome checks. PostgreSQL
mutation tests verify two serial updates each complete a two-parent fallback batch
before the next result, uncommitted visibility, application-driven rollback on
GraphQL errors, and rejection of expired transaction Collections. SQLite conflict
tests preserve four-parent batching and independent field/variant prerequisites.

Final release verification at `f954fa8be` reran all 113 monorepo tasks without
cache hits: 42 build/generate tasks followed by 71 test/type tasks. Running the
phases separately ensures package-import tests cannot race their own build cleanup.
All passed, including Prisma, Drizzle, and the 376 Prisma Next tests. Biome passed
on all 1,045 tracked files; generated files left no tracked diff.

A fresh external consumer installed tarballs of the current core, selection mapper,
Relay, with-input, and Prisma Next packages. On Node 24.15.0, ESM and CommonJS
imports passed even with the optional plugins physically absent. TypeScript 5.9.3
strict declaration checks passed without skipLibCheck for both SQL facades and
both module formats, including declarative relation parents, nullable cursor codec
inference, and connection helpers. The packed SQLite consumer executed nullable
pagination across pages and conflicting to-one fallback selections successfully.
The tarball manifest has public access, exact RC9 ORM peers, and resolved workspace
dependency specifiers. This verifies the staged 0.0.0 package; the earlier isolated
0.1.0 version simulation remains a separate check. No package was published.
