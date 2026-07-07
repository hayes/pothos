# Dossier: Unions (fundamentals)

Territory: `builder.unionType(name, { types, resolveType })` exact signature/options; the
`resolveType` contract vs interfaces (is "same contract" honest?); the no-`isTypeOf`/no-
`resolveType` behavior and who errors; union-member constraints (object types only); and a
claim-by-claim inventory of `website/content/docs/fundamentals/unions.mdx`, including the
"when unions vs interfaces" framing.

All paths relative to the worktree root (`…/pg-audit/`). Citations are
`packages/core/src/<file>:<line>` unless noted as a test/example/website path.

---

## 1. `builder.unionType` — exact signature & options

- Signature: `builder.ts:468-475`
  ```ts
  unionType<Member extends ObjectParam<Types>, ResolveType>(
    name: string,
    options: PothosSchemaTypes.UnionTypeOptions<Types, Member, ResolveType>,
  ): PothosSchemaTypes.UnionRef<Types, AbstractReturnShape<Types, Member, ResolveType>, ParentShape<Types, Member>>
  ```
  Unlike `objectType`/`interfaceType`, the first param is always a **plain `name` string**
  (there is no class/ref-first form and no third positional `fields` arg — unions have no
  fields).
- Options — `UnionTypeOptions` at `types/global/type-options.ts:113-127` extends
  `BaseTypeOptions` (`description?`, `extensions?`, `astNode?`) and adds exactly:
  - `types: Member[] | (() => Member[])` (`:118`) — **required**; array or lazy thunk of
    union members.
  - `resolveType?` (`:120-126`) — see §2.
  - `astNode?: UnionTypeDefinitionNode` (`:119`).
  - There is NO `fields` and NO `isTypeOf` option on unions.
- Runtime wiring (`builder.ts:468-502`): a `UnionRef` is constructed with the config
  (`:476-490`), `resolveType` copied onto config (`:486`); each member is `verifyRef`'d if
  `types` is an array (`:492-496`, undefined-guard only); ref registered (`:498`);
  `ref.addTypes(options.types)` (`:499`) supports arrays and lazy thunks and defers empty
  arrays (`refs/union.ts:28-61`).

## 2. `resolveType` contract — vs interfaces

### 2a. TYPE-LEVEL
- `UnionTypeOptions.resolveType` (`types/global/type-options.ts:120-126`):
  ```ts
  resolveType?: ResolveType &
    ((parent: ParentShape<Types, Member>, context: Types['Context'], info: GraphQLResolveInfo, type: GraphQLUnionType)
      => MaybePromise<Member | string | null | undefined>);
  ```
- **Compare interface** (`type-options.ts:104-110`): return is
  `MaybePromise<ObjectParam<Types> | string | null | undefined>`; parent is `Shape`.
- **Is "same contract as interfaces" honest?** Substantially YES, with two precise
  differences worth not overstating:
  1. **Parent type:** union's `parent` is `ParentShape<Types, Member>` (the union over its
     members' parent shapes); interface's `parent` is the interface's own `Shape`. Both are
     "the value flowing through the field," so the mental model is the same.
  2. **Return type:** union returns `Member | string | …` (a member ref/class from *its own
     `types` list*, or a name string); interface returns `ObjectParam | string | …` (any
     object param, or a name string). Both accept a **name string** (the documented
     `val.kind` one-liner) and null/undefined; both are `MaybePromise`.
  So docs saying "same rules as interfaces: return the concrete type's name as a string" is
  **HONEST** for the string form the docs actually teach. The 4th `type: GraphQLUnionType`
  arg is genuinely a `GraphQLUnionType` here (accurate for unions; it was cosmetically
  inaccurate for interfaces — see interfaces dossier §3a).

### 2b. RUNTIME (and the interface asymmetry)
`buildUnion` (`build-cache.ts:608-668`) resolver precedence:
1. **Type brand first.** If `parent` is an object carrying `typeBrandKey`, return the brand
   string, or `getTypeConfig(brand).name` for a ref brand. `build-cache.ts:615-623`.
2. **No `resolveType` → graphql's `defaultTypeResolver`.** `build-cache.ts:625-627`.
3. **`resolveType` set → call it, then NORMALIZE the result** via `getResult`
   (`build-cache.ts:629-655`): a `string` or falsy is returned as-is (`:634-636`); a
   `GraphQLObjectType` → its `.name` (`:638-640`); otherwise try
   `configStore.getTypeConfig(result).name` (`:642-646`, i.e. a returned **Pothos ObjectRef/
   class is normalized to its type name**); async results are awaited (`:653-655`).
- **KEY ASYMMETRY vs interfaces:** unions normalize a returned ref/class to a name;
  interfaces do NOT (interfaces dossier §3b, `build-cache.ts:588-590`). So on the union side,
  returning a member ref/class from `resolveType` is genuinely supported at runtime; on the
  interface side only string/`GraphQLObjectType` returns are verified. Docs that link
  unions→interfaces as "same contract" are honest for the **string** return (what both pages
  teach); do not generalize the ref-return support from unions to interfaces.
- Final resolver wrapped by `this.plugin.wrapResolveType(resolveType, config)`
  (`build-cache.ts:666`).

## 3. No `isTypeOf`/no `resolveType` — who errors

- Unions have **no `isTypeOf` option at all** (§1). The only member-side discriminator route
  is that each member object type may carry its own `isTypeOf` (an object-type option,
  `type-options.ts:51`), which graphql's `defaultTypeResolver` consults.
- When the union has **no `resolveType`**, `buildUnion` uses `defaultTypeResolver`
  (`build-cache.ts:625-627`). If additionally no member declares `isTypeOf` (and the value
  is not branded), `defaultTypeResolver` finds no match and **graphql-js** throws at runtime
  ("Abstract type … must resolve to an Object type at runtime …"). This is graphql-js's
  execution-time error, not a Pothos build error — Pothos performs no build-time check that a
  union is resolvable.

## 4. Union-member constraints — object types only

- Members are constrained to `ObjectParam<Types>` at the type level: `unionType<Member
  extends ObjectParam<Types>, …>` (`builder.ts:468`) and `types: Member[]`
  (`type-options.ts:118`). `ObjectParam` = registered object name | `ObjectRef` |
  constructor (`types/type-params.ts:118-125`) — i.e. **object types only** (no interfaces,
  unions, scalars, or enums).
- Runtime: members are resolved as objects when built —
  `types: () => config.types.map((member) => this.getTypeOfKind(member, 'Object'))`
  (`build-cache.ts:665`) — `getTypeOfKind(..., 'Object')` enforces the kind. graphql-js
  additionally rejects non-object union members at schema construction.

---

## 5. Inventory of `website/content/docs/fundamentals/unions.mdx`

Line refs into the mdx.

- L8 "A union returns one of several object types that don't share fields … an interface
  demands every implementer carry common fields … a union groups types purely by 'what is
  this thing?'" — **TRUE & sound.** Object-only members (§4); no shared-field requirement
  (unions have no fields, §1).
- L10 include region `#search-result-union,search-query` via `<includeregions>` — **regions
  EXIST** (`schema.ts:50/55` and `57/73`). ✔
- L12 "Each value the resolver returns has to be assignable to one of the `types` listed.
  `resolveType` picks which one." — **TRUE** (§2, §4).
- L16-21 "When to reach for a union": search results / activity feeds / mutation outcomes
  (with `plugin-errors` link) — **sound editorial**; the mutation-outcome + `plugin-errors`
  pairing matches the errors plugin's union pattern (see class-backed dossier §5b,
  `packages/plugin-errors/tests/manual-error-union.test.ts`). Not a code claim; no conflict.
- L22 "If the types do share fields, prefer an interface; clients can then select common
  fields without the per-type fragment dance." — **TRUE & this is the "unions vs interfaces"
  decision the curriculum asks for.** Grounded: interfaces expose shared fields on the
  abstract type (interfaces dossier §6-7), unions do not (§1 here). Sound.
- L26 "Same rules as interfaces: return the concrete type's name as a string." — **HONEST**
  for the taught string form (§2a). The subtle ref-return asymmetry (§2b) is not invoked by
  the page, so no misstatement.
- L28 `resolveType: (val) => val.kind` — **TRUE**: `val.kind` is `'Character' | 'Location' |
  'Quote'` (`schema.ts:4,10,17`), each matching a member type name (`schema.ts:32,36,44`).
  String return needs no normalization.
- L34-40 shape-sniffing variant (`'terrain' in val` → 'Location', `'text' in val` → 'Quote',
  else 'Character') — **TRUE** and consistent with the example shapes (`terrain` on Location
  `schema.ts:13`, `text` on Quote `:18`).
- L44-63 GraphQL query using `__typename` + per-type fragments (`... on Character`, etc.) —
  **TRUE**, standard client-side GraphQL. Honest framing needed: `__typename` and fragments
  are GraphQL-spec/graphql-js, not Pothos (interfaces dossier §8).
- L45/L65 "`__typename` is always available on union fields — it's the discriminator clients
  use" — **TRUE** (spec meta-field). Keep attribution to GraphQL, not Pothos.
- L67-69 cross-links to interfaces / plugin-errors — fine.

**No WRONG claims found in unions.mdx.** The "same rules as interfaces" line (L26) is honest
for the string-return form the page teaches; the only nuance (union `resolveType` also
normalizes ref/class returns, interfaces do not, §2b) is not something the page claims, so
there is nothing to correct. The unions-vs-interfaces guidance (L8, L22) is sound.

---

## 6. Docs-writing guidance (grounded)

- The "share fields → interface; don't → union" heuristic (L8/L22) is correct and is the
  curriculum's when-to-use answer; keep it.
- Keep `resolveType` examples in the **string** form (`val.kind`); it is the portable path
  across both unions and interfaces (§2b).
- Keep `__typename`/fragments attributed to GraphQL, not Pothos (§5, interfaces dossier §8).
- Safe to note members must be **object types** (§4) if a reader asks "can a union include an
  interface?" — no.

---

## 7. UNRESOLVED / UNVERIFIED

- **UNVERIFIED (exact wording):** the literal graphql-js error string for the
  no-`resolveType`/no-`isTypeOf` union case (§3). Mechanism cited (`defaultTypeResolver`
  fallback, `build-cache.ts:625-627`) and that the throw is graphql-js's at execution time;
  literal message not captured by running a query.
- **NOTE (not a defect):** union `resolveType` may return a member ref/class and it is
  normalized at runtime (`build-cache.ts:642-646`); the page never uses this, so it is
  neither claimed nor contradicted — recorded only to prevent a docs writer from
  back-porting the assumption to the interfaces page (where it is unverified).
