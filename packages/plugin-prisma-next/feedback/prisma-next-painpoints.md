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

**Workaround location**: `src/utils/render-selection.ts` (`assertNoPaginationLeak` — invoked from both `renderBranch`'s non-paginated arm and `renderCount`).

**Workaround**: entry-level `Omit` plus a runtime guard in
`renderSelection`'s count branch. After the user's `refine` runs we
inspect the returned collection's `state.limit` / `state.offset` and
throw `PothosValidationError` with a clear message before the count
fires. Catches `(rel) => rel.take(N)` AND chained
`(rel) => rel.where(x).take(N)`. The user gets a diagnostic at the
relation-load callsite instead of a silently-wrong totalCount.

The orm-client's `Collection.aggregate()`-as-peer-branch alternative
suggested by an audit *can't* work: `Collection.aggregate` is async
and `Collection.include(rel, cb => …)` callbacks must be synchronous.
The synchronous primitive `cb.count()` is what we use, plus the guard.

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

Query `{ users { posts { author { ... } } } }` should be one SQL
statement. orm-client falls back to a per-row include plan above depth 1,
so `captures.length >= 1` rather than exactly 1.

**Workaround location**: `src/utils/map-query.ts` (`mapSelectionSet`'s FK augmentation walks every branch's `parentFkColumns` into the parent's `.select(...)`). Tests assert `>= 1` capture count.

**Workaround**: same as above — loose test expectation, document as
known limitation.

**Desired upstream change**: SQL planner support for nested-include
flattening. Tracked as "Issue A" in the prisma-next handoff.

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

## 7. `ContractRelation` lists 1:1 | 1:N | N:1, but orm-client's `RelationCardinalityTag` already has `M:N`

**Where this hurt**: `t.relation` / `t.relatedConnection` cardinality
detection.

`ContractRelation` in `@prisma-next/contract` is currently
`1:1 | 1:N | N:1`. But orm-client's `RelationCardinalityTag` (and
`IsToManyRelation`) already account for `M:N`. The contract layer is
catching up.

**Workaround location**: `src/prisma-next-object-field-builder.ts` (`isToManyCardinality`) plus the M:N runtime assertion in `src/utils/map-query.ts` (`getRelationLocalFields`).

**Workaround**: runtime check is now
`cardinality !== '1:1' && cardinality !== 'N:1'` (`isToManyCardinality`
helper). Future-proof: when contract lands `M:N`, the runtime
treats it as to-many automatically (matching `IsToManyRelation`),
and `t.relatedConnection` / `t.relationCount` / `t.relationAggregate`
unblock on M:N relations without further changes.

**Desired upstream change**: contract should adopt
`RelationCardinalityTag` directly, or at minimum add `'M:N'` to
`ContractRelation`. Today the inconsistency means the contract type
"forbids" something the orm-client already supports.

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
