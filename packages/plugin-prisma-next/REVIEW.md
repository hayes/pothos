# `plugin-prisma-next` design review — findings, decisions, execution plan

Companion to `ARCHITECTURE.md`. Captures the architectural pass that
ran 2026-05-13 and the agreed execution order.

---

## Status of each finding

### Accepted — landing now

1. **Drop fragment cycle guards.** GraphQL.js's `validate()` runs
   `NoFragmentCycles` by default. Two guard sites (apply-selection.ts and
   selection-walk.ts) trust the spec instead.
2. **Drop auto-branding in `wrapResolve`.** Match plugin-prisma's pattern:
   `addBrand` / `hasBrand` methods on the ref, no automatic brand at the
   prismaField boundary, no iterable / async-iterable wrappers. Add
   `abstractReturnShapeKey` to refs for TS shape inference in abstract
   positions. Keep `rebrandForVariant` (scoped, explicit use).
3. **Switch combine-key separator to a GraphQL-forbidden character.**
   `__` is valid in GraphQL field names; the reserved-alias check
   (`__proto__`/`constructor`/`prototype`) exists because of this. A
   character GraphQL syntax forbids (e.g. `:`) eliminates the entire
   collision class and the defensive code.
4. **Drizzle-shape refs.** Drop `markRefRegistered`,
   `findOrphanedDefaultRef`, `assertNoVariantOnlyRegistration`,
   `findVariantTypeNames`, `registeredKeysMap`. Variants get fresh
   refs (not cached). Missing default refs surface as Pothos's
   native unresolved-ref error.
5. **Precompute relation metadata at type config.** Walk model relations
   once at `onTypeConfig`, cache `{ isToMany, localFields, targetTypeName }`
   per relation on the type extension. Walker stops touching the
   contract in the hot path; M:N validation fail-fasts at schema build.
6. **Drop `t.relatedField` / `t.relationCount` / `t.relationAggregate`.**
   All three are achievable with `t.field({ select, resolve })`. Three
   methods + ~200 LOC removed.
7. **Collection-as-return-type for `t.prismaField`.** Eliminate the
   `apply` callback. Resolver signature becomes the standard
   `(parent, args, ctx, info) => Collection`. Plugin's `wrapResolve`
   detects the Collection return and runs
   `applySelectionToCollection(coll, info, …).get()` automatically.

### Deferred — investigate later

8. **Per-field overlay → single-pass row normalize.** Doesn't survive
   the "fields can have incompatible selections" objection. The current
   per-resolve overlay handles namespacing naturally. Leave as-is.
9. **Double pagination pass in `t.relatedConnection`.** Stashing
   pagination state on parent isn't clean. Defer.
10. **Consolidate `t.prismaConnection` and `t.relatedConnection`
    through `prismaConnectionHelpers`.** Audit first: the related-
    connection pipeline may be the better implementation; the helper
    needs to express the inline-include pagination shape that
    relatedConnection uses.
11. **Type-import `Collection` from orm-client instead of
    `MapperCollection`.** Worth a prototype experiment — would need to
    see whether `Collection<TContract, M, Row, State>` typing inside the
    emission code is manageable or proliferates casts.
12. **Rename `t.relation`'s `query` option to flat `where`/`orderBy`/
    `take`/`skip` top-level options.** Polish, not redesign. Defer.

### Retracted — left in place

- The `query` option on `t.relation` is **not legacy sugar** — it's the
  canonical refinement API and the walker descends through the
  relation's nested selection to pull columns into the include's
  SELECT. Keep as-is.
- `t.variant` stays.
- Five-method consolidation rejected; only the three pure-sugar methods
  are dropped.

---

## Execution order

Each step is independently shippable. After step 7 lands, the plugin
has one `wrapResolve` branch (the per-field overlay), no auto-branding,
no per-walk contract probing, no collision-prone separator, no
fragment-cycle bookkeeping, no variant-only-registration guard
machinery, three fewer methods, and no quirky `apply` callback.

1. Drop fragment cycle guards.
2. Drop auto-branding in `wrapResolve`.
3. Switch combine-key separator.
4. Drizzle-shape refs.
5. Precompute relation metadata in type extension.
6. Drop `t.relatedField` / `t.relationCount` / `t.relationAggregate`.
7. Collection-as-return-type for `t.prismaField`.

Test infrastructure (the `RecordingCollection` mock in
`tests/execute.test.ts` and the SQL-capture middleware in
`tests/fixtures/runtime.ts`) covers all of these — assertions should
move with the implementation, not require new fixtures.

---

## Original findings — see git history

The verbose original-form findings (with rationale, line refs, and
counter-arguments) are preserved in the git history of this file.
This is the active execution document.
