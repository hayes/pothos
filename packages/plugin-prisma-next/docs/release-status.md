# Initial 0.1.0 release status

This implementation follows two constraints: selections are complete without
fallback model loading, and Pothos has no SQLite/PostgreSQL-specific behavior.
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
| Deferred fragments omitted | Included in complete plan; real incremental GraphQL test verifies no later SQL |
| Default node isTypeOf rejects normal rows | Removed brand-only concrete predicate; preserve explicit user predicate and node-loader brands |
| ID-only node selection misses ID columns | Node ID field declares its selected columns; regression for direct concrete node access |
| Errors-wrapped root lists materialize one row | Original list shape is retained in prepared field metadata; errors-wrapper regression |
| Mixed-null composite FK inference | Existential nullable-field check; type regression |
| Existing ordering breaks page two | Connections own complete ordering, reject preordered/paginated bases before SQL |
| Descending/mixed cursors | Explicit per-field direction, forward/backward/both-bound runtime coverage |
| Nonunique/nullable cursors | Schema-time contract validation requires non-null fields containing a full unique key |
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
- **Incompatible to-one refinements:** rejected before execution. Upstream RC9
  rejects to-one combine with ORM.INCLUDE_UNSUPPORTED. Compatible consumers merge;
  independent to-many consumers work. This does not imply a fallback loader.
- **Native ORM inheritance and duplicate namespace model names:** not exposed as
  dedicated Pothos concepts. GraphQL variants are same-model views. A qualified
  model identity and inheritance-specific contract design need separate work.
- **Nullable cursor keys:** rejected. Complete non-null unique ordering is the
  supported contract; a future null-ordering policy needs its own tests.
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
from public Collection/aggregate types. Connection validation reads the pinned
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


Final local integration run: 33 test files / 318 tests passed, both type projects
passed, and all 113 monorepo build/generate/type/test tasks passed. The root Biome
command encountered an unrelated nested worktree configuration; checking all
Git-tracked files explicitly passed. A release simulation produced public 0.1.0
with core peer ^4.14.0, without modifying this checkout's release versions.
