# prisma-next painpoints discovered while building plugin-prisma-next

Running log of friction we've hit integrating Pothos with prisma-next.
Each entry: what the integration wanted to do, what blocked it, what
workaround we shipped.

---

## 1. `Collection.where(...)` returns the full Collection — can't lock a refinement view to filter-only

**Where this hurt**: `t.relatedConnection({ refine })`.

Cursor pagination owns `take` / `skip` / `orderBy`. Pothos passes a
refinement collection into the user's `refine` callback, and we want
that callback to be filter-only — no pagination ops, no re-ordering.
The synthetic `totalCount` branch reuses the same refine, so a
`refine: (rel) => rel.take(50)` would corrupt the count.

We can `Omit<Collection, 'take' | 'skip' | 'orderBy'>` at the entry,
but the moment the user chains `.where(...)`, prisma-next's return
type is the full `Collection<TContract, M, Row, WithWhereState<State>>`
— `take`/`skip`/`orderBy` are back in scope. So
`(rel) => rel.where(...).take(50)` compiles cleanly even though it
breaks both cursor pagination and totalCount.

**Workaround location**: type-level `Omit<Collection, 'take' | 'skip' | 'orderBy'>` at the option entry only. No runtime guard exists today — earlier drafts of this doc claimed an `assertNoPaginationLeak` function in `render-selection.ts`; that was wishful thinking and never landed.

**Workaround**: entry-level `Omit` on the option's surface type. In
practice, every public refine entry is funneled through `compileWhere`
(`src/utils/compile-query.ts`) or `compileDeclarativeRefine`
(`src/utils/apply-selection.ts`, inline), both of which only invoke
`.where(...)` / `.orderBy(...)` / `.take(...)` / `.skip(...)` against
the refinement collection — pagination methods on the chain-typed
return are unreachable from the current option shapes. The threat is
currently structural-only; the missing runtime guard would only
matter if a future API expansion exposes a raw-refine callback that
returns a `Collection`.

The orm-client's `Collection.aggregate()`-as-peer-branch alternative
suggested by an audit *can't* work: `Collection.aggregate` is async
and `Collection.include(rel, cb => …)` callbacks must be synchronous.
The synchronous primitive `cb.count()` is what we use.

**Desired upstream change**: a refinement-view variant of `Collection`
that omits pagination operations at every chain step. Something like:

```ts
Collection.filterView(): FilterRefinementCollection<TContract, M, Row, State>
// or a discriminator on Collection's State that gates take/skip/orderBy
```

A recursive `Omit` in our plugin works for narrowing the type but
discards model-accessor inference inside chained `.where((row) => row.col.eq(x))`
calls — rows widen to `any`. The narrowing has to come from prisma-next
to preserve `ModelAccessor` typing.

---

## 2. Contract surface has no field/model descriptions

**Where this hurt**: `exposeDescriptions` plugin option.

plugin-prisma surfaces Prisma's `/// description` comments as GraphQL
descriptions when `exposeDescriptions: true`. The prisma-next contract
JSON ships model + field shape but no `description` field on either
the model or field nodes, so the option is unimplementable.

**Workaround location**: N/A — option not implemented.

**Workaround**: dropped the option for v0.1. Users hand-write descriptions
inside `t.exposeX('col', { description: '...' })`.

**Desired upstream change**: `description?: string` on
`ContractModel` and `ContractField` (plus emission from the contract
source format, whatever that ends up being).

---

## 3. Combine + count falls back to multi-query

**Where this hurt**: every `t.relationCount` (and the synthetic
`totalCount` branch on `t.relatedConnection`).

The mapper emits `rel.combine({ alias: cb, _totalCount: cb.count() })`
inside an include refinement. orm-client's
`hasComplexIncludeDescriptors` short-circuit detects the count inside
the combine and falls back to a multi-query plan rather than collapsing
to a single SQL statement. Our tests document this with
`expect(captures.length).toBeGreaterThanOrEqual(1)` instead of
`toHaveLength(1)`.

**Workaround location**: test assertions across `tests/runtime.test.ts` and `tests/connection.test.ts` use `>= 1` rather than `=== 1` for count captures.

**Workaround**: accept the multi-query fallback; document the test
expectation as loose.

**Desired upstream change**: SQL planner support for combine + count
in a single query. Tracked as "Issue B" in the prisma-next handoff.

---

## 4. Depth-2+ nested includes fall back to multi-query

**Where this hurt**: every `t.prismaField` with depth ≥ 2 relations.

### Empirical evidence (pinned in a runtime canary)

`tests/runtime.test.ts` runs the GraphQL query
`{ users { id posts { id author { id firstName } } } }` against a
real SQLite database and captures three SQL statements:

```
SELECT "user"."id" FROM "user"
SELECT "post"."id", "post"."authorId" FROM "post" WHERE "post"."authorId" IN (?, ?)
SELECT "user"."id", "user"."firstName" FROM "user" WHERE "user"."id" IN (?, ?, ...)
```

One round-trip per relation level. SQLite has `json_group_array` so
the orm-client's `selectIncludeStrategy` resolves to `'correlated'` —
which CAN do this in a single SELECT — but the dispatcher
unconditionally skips that path the moment any include has nested
includes.

### The smoking gun

`packages/3-extensions/sql-orm-client/src/collection-dispatch.ts:80-85`:

```ts
if (
  hasNestedIncludes(options.state.includes) ||
  hasComplexIncludeDescriptors(options.state.includes)
) {
  return dispatchWithMultiQueryIncludes<Row>(options);   // ← always wins for depth-2+
}
switch (strategy) {                                       // only reached for depth-1
  case 'lateral':    return dispatchWithSingleQueryIncludes(...);
  case 'correlated': return dispatchWithSingleQueryIncludes(...);
  default:           return dispatchWithMultiQueryIncludes(...);
}
```

```ts
function hasNestedIncludes(includes: readonly IncludeExpr[]): boolean {
  return includes.some((include) => include.nested.includes.length > 0);
}
```

ANY include with `nested.includes.length > 0` short-circuits the
strategy check. Capability flags (`lateral`, `jsonAgg`) are ignored
the moment depth ≥ 2 enters the picture.

### Workaround location

`src/utils/apply-selection.ts:walkSelectionSet` runs FK augmentation
after collecting selections so the parent's FK columns ride into the
parent SELECT — required for the multi-query stitch to produce
correct results at depth ≥ 2 even when the GraphQL query didn't ask
for the FK. Per-relation `localFields` come from the precomputed
`pothosPrismaNextRelations` type extension built by
`buildRelationMeta` in `src/index.ts`.

Test assertions across `tests/runtime.test.ts` and
`tests/connection.test.ts` use `captures.length >= 1` (or
`> 1` / `>= 3`) instead of `=== 1` for nested-include queries. One
canary pins `> 1` at the smoking-gun site so we know when upstream
fixes it.

### Workaround

Loose capture-count expectations + correct fallback stitching.
Documented as a known limitation.

### Desired upstream change

SQL planner support for nested-include flattening. The single-query
strategies (`lateral` and `correlated`) already exist and are
exercised at depth 1 — they need to compose recursively so depth ≥ 2
collapses to one SELECT instead of dispatching through
`dispatchWithMultiQueryIncludes`. Tracked as "Issue A" in the
prisma-next handoff. Also called out in prisma-next's own
pothos-integration demo
(`prisma-next/examples/pothos-integration/README.md`, "Every relation
level is its own SQL statement").

---

## 5. `RelationNames<C, M>` / `RelatedModelName<C, M, R>` collapse in generic positions

**Where this hurt**: every relation-name parameter on the field
builder (`t.relation('rel')`, `t.relationCount('rel')`, etc.).

orm-client exports `RelationNames<C, M>` and `RelatedModelName<C, M, R>`
that resolve through `RelationsOf` → `ExactRecord`. When `M` is a
generic parameter (not a literal), `ExactRecord` collapses to
`Record<string, never>` and the relation-name union becomes `never`.
The plugin's user-facing API does have `M` as a generic — it's the
model name a `prismaObject` was registered for.

**Workaround location**: `src/types.ts` (`RelationKeys`, `RelatedModel`, `IsToMany`).

**Workaround**: hand-rolled `RelationKeys<Types, M> = keyof
Types['PrismaNextContract']['models'][M]['relations'] & string`. Indexed
access defers resolution and unifies cleanly. Same workaround
plugin-drizzle uses with `keyof TableConfig['relations']`.

**Desired upstream change**: make orm-client's relation accessors safe
in generic positions, or document the indexed-access workaround as the
canonical pattern for plugin authors.

---

## 6. `IsToOneRelationNullable` exists but isn't exported

**Where this hurt**: `DefaultRelationNullable<Types, M, R>` inference
for `t.relation`.

orm-client has the logic to determine if a to-one relation is nullable
(any of its `localFields` is nullable on the parent model) but the
helper isn't exported. We had to port a minimal version
(`AnyFieldNullable`) into the plugin.

**Workaround location**: `src/types.ts` (`AnyFieldNullable` + `DefaultRelationNullable`).

**Workaround**: minimal port in `types.ts`.

**Desired upstream change**: export `IsToOneRelationNullable` (or a
public-named equivalent) from `@prisma-next/sql-orm-client`.

---

## 7. Many-to-many is half-shipped in prisma-next

**Where this hurt**: any user authoring a many-to-many relation via
`rel.manyToMany(...)` and expecting `t.relation` to work over it.

### Empirical evidence (the canary test pins this)

Running `Collection.include('tags')` against a hand-crafted contract
with `cardinality: 'N:M'` (what `rel.manyToMany` emits) produces this
`IncludeExpr`:

```
{
  relationName: "tags",
  relatedModelName: "Tag",
  relatedTableName: "tag",
  targetColumn: "userId",   // <-- column on the JUNCTION, doesn't exist on Tag
  localColumn: "id",
  nested: { filters: [], includes: [] }
  // no `cardinality` — parseRelationCardinality dropped 'N:M'
  // no `through` — junction metadata discarded
}
```

The plumbing flattens an M:N relation into a single-column FK join
that points at a junction column on the wrong table. The next SQL
emission step would generate `SELECT ... FROM tag WHERE userId IN (...)`
which is invalid (Tag has no `userId` column). Pinned in
`tests/prisma-next-m-n-upstream-pin.test.ts` — the day prisma-next
fixes this, the canary fails and we know to flip the plugin's
rejection.

### Upstream's own docs say this isn't supported

From `prisma-next/packages/2-sql/2-authoring/contract-psl/README.md`:

> Implicit Prisma ORM many-to-many remains unsupported (list
> navigation on both sides without explicit join model). Represent
> many-to-many with an explicit join model (two foreign keys).

From `prisma-next/examples/pothos-integration/README.md` ("What's
deliberately not implemented"):

> Indirect / M:N relations through join tables.

### The mechanical cause

prisma-next's authoring DSL has `rel.manyToMany(target, { through, from, to })`
(`packages/2-sql/2-authoring/contract-ts/src/contract-dsl.ts:1314`).
The lowering writes `cardinality: 'N:M'` plus a
`through: { table, parentCols, childCols }` block into the emitted
contract (`build-contract.ts:336-352`). But:

- The foundation contract type hasn't caught up:
  `ContractReferenceRelation.cardinality` still says
  `'1:1' | '1:N' | 'N:1'` (`foundation/contract/src/domain-types.ts:33`)
  and the lowering openly casts past it ("cast is needed until the
  contract type is extended").
- orm-client's `RelationCardinalityTag` spells it `'M:N'` (note the
  swap) — different from the `'N:M'` the emit produces. No
  normalization in `parseRelationCardinality` (`collection-contract.ts:284`).
- orm-client's runtime has no junction-table read path. The
  `IncludeExpr` data structure carries single-column joins only.
  `mutation-executor.ts:343-344` explicitly throws "M:N nested
  mutations are not supported yet" — but the read path silently
  generates invalid SQL instead of throwing.

### Workaround location

Schema-build rejection inside `buildRelationMeta` (`src/index.ts`),
called from the plugin's `onTypeConfig` hook. Catches BOTH spellings
(`'N:M'` and `'M:N'`) and points users at the explicit-junction-model
workaround in the error message.

### Workaround

Model the junction as its own contract model and chain two `t.relation`
calls (`User → UserTag → Tag`). Goes through the normal walker, no
special handling needed. Documented in
`website/content/docs/plugins/prisma-next/relations.mdx`. Matches the
upstream PSL guidance verbatim.

### Desired upstream changes (any one unblocks)

1. orm-client implements junction-table reads — `IncludeExpr` needs a
   `through` field and `stitchRowInclude` needs a two-hop join code
   path. The junction column metadata already lands in the emitted
   contract; only execution needs work.
2. Normalize the spelling — pick `'N:M'` OR `'M:N'` and use one
   consistently across contract emit, foundation type, and orm-client.
3. Extend the foundation contract type to include the M:N cardinality
   so the lowering doesn't need a cast.

---

## 8. SQL-only vs Mongo `Collection` shape

**Where this hurt**: the plugin's `AnyContract = Contract<SqlStorage>`
constraint.

prisma-next's `@prisma-next/sql-orm-client` and
`@prisma-next/2-mongo-family/.../orm` expose different `Collection`
shapes. SQL has `.include('rel', cb => cb.where(...).combine({...}))`
(callback form); Mongo has `.include('rel')` (no callback, no combine).
Our mapper emits SQL-shaped calls (`.combine`, predicate-callback
`.where`) so it's SQL-only by construction.

**Workaround location**: `src/types.ts` (`AnyContract = Contract<SqlStorage>`).

**Workaround**: plugin documents itself as SQL-only. Mongo support
would require a parallel mapper + parallel field builders.

**Desired upstream change**: not necessarily — the storage families
are intentionally separate. But a shared sub-interface for
"chainable refinement + include" would let one mapper target both.

---

## How we feed this back

This list lives alongside the integration code so it stays current as
we hit new friction. When we ship a prisma-next-version bump, walk
each item and either:
- Remove items the upstream now solves, OR
- Update the workaround if the surface changed.

For items that are still painpoints, surface them to the prisma-next
team via whatever channel is current (issue, RFC, paired chat).
