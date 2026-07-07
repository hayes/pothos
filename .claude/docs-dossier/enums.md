# Dossier: Enums (fundamentals)

Territory: every enum-definition form `@pothos/core` supports (array-of-strings, object
value-config map, TypeScript-enum backing, `Object.values` array), their exact signatures and
inferred TS shapes; the **name-vs-value** mapping (what the resolver returns vs what the client
sees — the classic gotcha); the per-value options (`description`, `deprecationReason`, `value`,
`extensions`, `astNode`); and a claim-by-claim inventory of
`website/content/docs/fundamentals/enums.mdx` against the canonical `Faction` cast shape.

All paths relative to the worktree root (`…/pg-audit/`). Citations are
`packages/core/src/<file>:<line>` unless noted as a test/example/website path. Every line cited
was read.

---

## 1. `builder.enumType` — signature, params, forms

- **Single implementation, one overload signature** (`builder.ts:504-543`):
  ```ts
  enumType<Param extends EnumParam, const Values extends EnumValues<Types>>(
    param: Param,
    options: EnumTypeOptions<Types, Param, Values>,
  ): PothosSchemaTypes.EnumRef<
    Types,
    Param extends BaseEnum ? ValuesFromEnum<Param> : ShapeFromEnumValues<Types, Values>
  >
  ```
  There is **no second positional signature** — the string-vs-TS-enum branch is entirely in the
  *types* (`EnumTypeOptions`, §1d) and in one runtime `typeof` check (`builder.ts:512-520`).
- `EnumParam = BaseEnum | string` (`types/type-params.ts:142`); `BaseEnum` is the structural
  shape of a TS enum object (`types/type-params.ts:135`). So `param` is **either** a name string
  **or** a TS-enum object.
- The return is an `EnumRef<Types, T, U=T>` — `refs/enum.ts:11-28` — which implements both
  `OutputRef<T>` and `InputRef<U>` (`:13`), i.e. one ref usable as **field type and as arg
  type**. `$inferType`/`$inferInput` expose the shapes (`:17-19`).

### 1a. Array form (the "lightest" form)
```ts
builder.enumType('Alignment', { values: ['Good', 'Neutral', 'Evil'] as const })
```
- `param` is the name string; `options.values` is `readonly string[]`
  (`types/builder-options.ts:89` — `EnumValues = EnumValueConfigMap | readonly string[]`).
- Runtime: `normalizeEnumValues` (`builder.ts:520` → `utils/enums.ts:3-30`). For an array it does
  `result[String(key)] = { pothosOptions: {} }` (`utils/enums.ts:8-13`) — **no `value` field is
  set**, so graphql-js uses the value *name* as the internal value (name === value, see §2).
- Inferred TS shape: `ShapeFromEnumValues` → `Values[number]`
  (`types/builder-options.ts:96-100`), i.e. `'Good' | 'Neutral' | 'Evil'`. The `const Values`
  type param (`builder.ts:504`) + caller's `as const` are what preserve the literal union;
  without `as const` inference widens to `string[]` and the union is lost.

### 1b. Object value-config map form
```ts
builder.enumType('Alignment', {
  values: {
    Good: { description: 'Helps the heroes.' },
    Evil: { value: 'EVIL', deprecationReason: '…' },
  } as const,
})
```
- `options.values` is an `EnumValueConfigMap = Record<string, EnumValueConfig>`
  (`types/builder-options.ts:91-94`). Each config is `PothosSchemaTypes.EnumValueConfig`
  (`types/global/type-options.ts:155-161`) with optional `description`, `value`,
  `deprecationReason`, `extensions`, `astNode`.
- Runtime: `normalizeEnumValues` object branch (`utils/enums.ts:14-27`): if the entry is an
  object it is spread and `pothosOptions` attached (`:16-20`); **if the entry is a bare string it
  is treated as a value name** (`result[value] = { pothosOptions: {} }`, `:21-25`) — an accepted
  but undocumented shape.
- Inferred TS shape: `ShapeFromEnumValues` config-map branch
  (`types/builder-options.ts:101-105`): for each key, **`value` if it is a `number | string`,
  else the key**. So `{ Good: {} }` → `'Good'`; `{ Evil: { value: 'EVIL' } }` → `'EVIL'`. This is
  the type-level twin of the runtime name-vs-value rule (§2).

### 1c. `Object.values(...)` array form
`builder.enumType('VehicleType', { values: Object.values(VehicleType) })` — this is just the
**array form** (§1a) fed the *values* of a const object. Names === those value strings. Proven by
`tests/enums.test.ts:173-189` (`resolve → VehicleType.motorcycle` = `'MOTORCYCLE'`, client sees
`'MOTORCYCLE'`).

### 1d. TypeScript-enum backing form
```ts
enum Alignment { Good = 'GOOD', Neutral = 'NEUTRAL', Evil = 'EVIL' }
builder.enumType(Alignment, { name: 'Alignment' })
```
- `param` is the enum object (`typeof param === 'object'`, `builder.ts:515`); `name` now comes
  **from `options.name`** (`builder.ts:512`) and is **required** — the `EnumTypeOptions` type
  switches to `{ name: string; values?: … }` when `Param extends BaseEnum`
  (`types/builder-options.ts:200-213`). `values` is optional here (a partial map of per-key
  config **without `value`**, since `value` is derived from the enum).
- Runtime: `valuesFromEnum(param, options.values)` (`builder.ts:516-519` → `utils/enums.ts:32-47`)
  builds `result[key] = { value: Enum[key], pothosOptions: {}, ...overrides }` (`:39-43`) and
  **filters reverse-mapping numeric keys** via
  `Object.keys(Enum).filter(key => typeof Enum[Enum[key]] !== 'number')` (`:38`) — this drops the
  synthetic `0 -> 'Good'` back-keys TS emits for *numeric* enums so only the named keys survive.
- Inferred TS shape: `ValuesFromEnum<Param> = Param[keyof Param]`
  (`types/type-params.ts:140`) — the enum's **value** union (`'GOOD' | 'NEUTRAL' | 'EVIL'` for a
  string enum; the numeric union for a numeric enum). This matches the runtime `value`, i.e. what
  the resolver returns/receives (§2).
- Ref association: TS-enum params are registered with the ref (`builder.ts:538-540`) so the enum
  object itself can later be used as a `type:`/`arg` param.

## 2. Name vs value — the classic gotcha (cite precisely)

GraphQL enums have a **value name** (the SCREAMING or PascalCase token in the SDL, what the client
sends and receives) and an **internal `value`** (what your resolver returns and your args
receive). Pothos maps every form onto graphql-js's `GraphQLEnumType` in `buildEnum`
(`build-cache.ts:715-742`): keys of the normalized map become value **names** (`:720`,
`values[key] = …`), and each config's `value` (if any) is the internal value.

- **Array form / `Object.values`:** no `value` set (`utils/enums.ts:8-13`) ⇒ **name === value**.
  Resolver returns the name string; client sees the same string.
- **Object map with `value:` / TS-enum form:** `value` is the internal backing value; the **name
  is always the key**. Resolver **returns the `value`** (e.g. `'EVIL'` / `Enum.Evil`); graphql-js
  **serializes it back to the key name** the client sees; an incoming arg name is
  **parsed to the `value`** before it reaches your resolver.

Proven end-to-end by `tests/enums.test.ts:36-137`, which runs the *same* assertions across all
four forms (test labels: numeric-enum "uses keys" `:38`, string-enum "uses keys" `:43`, object
entries `:47`, array "uses values" `:60`, object values `:67`):
- Introspected enum value **names are always the keys** `['Pawn','Knight',…]` regardless of form
  (`:108-114`).
- With `{ Pawn: { value: 'P' }, … }`, querying `piece(input: Pawn)` (client sends the **name**) →
  resolver receives/returns `'P'` (the **value**) → response is `Pawn` again (`:116-136`). Client
  never sees `'P'`.
- `tests/enums.test.ts:140-170`: object-entries with `value: 'SEDAN'` etc., resolver returns
  `VehicleType.motorcycle` (`'MOTORCYCLE'`) → client sees the **key** `'motorcycle'` (`:169`).
- Contrast `:173-189`: array form of the same values → resolver returns `'MOTORCYCLE'`, client
  sees `'MOTORCYCLE'` (name === value).

**One-line rule for docs:** *array form → resolver value is the enum-value name; object-`value`
or TS-enum → resolver deals in the backing `value`, clients always deal in the key name.*

## 3. Per-value options

`PothosSchemaTypes.EnumValueConfig` (`types/global/type-options.ts:155-161`), exactly:
- `description?: string`
- `value?: number | string` — the internal value (§2). **Omitted in the TS-enum form's override
  map** — that map is `Omit<EnumValueConfig, 'value'>` (`types/builder-options.ts:209`) because
  `value` is taken from the enum.
- `deprecationReason?: string`
- `extensions?: Readonly<Record<string, unknown>>`
- `astNode?: EnumValueDefinitionNode`

Enum-level options: `EnumTypeOptions` (`types/global/type-options.ts:38-44`) extends
`BaseTypeOptions` (`description?`, `extensions?`, `astNode?`, `:33-36`) and adds **`values`
(required)** and a narrowed `astNode?: EnumTypeDefinitionNode`. Per-value configs are wrapped as
`PothosEnumValueConfig extends GraphQLEnumValueConfig` (`types/configs.ts:164-166`); the enum
config is `PothosEnumTypeConfig extends GraphQLEnumTypeConfig` (`types/configs.ts:79-83`). At build
time each value config passes through `plugin.onEnumValueConfig` (`build-cache.ts:723-730`).

---

## 4. Inventory of `website/content/docs/fundamentals/enums.mdx`

Line refs into the mdx.

- **L8 + L10** "The lightest way … is the array form: an array of string literals marked
  `as const`" → includes region `alignment-enum` of
  `website/playground-examples/fundamentals-enums/schema.ts`. **TRUE & coherent.** That region
  (schema.ts `#region alignment-enum`) is `values: ['Good','Neutral','Evil'] as const` — genuinely
  the array form (§1a). ✔
  - **DEFECT (playground source, not the rendered docs):** the comment *above* the region marker
    in `fundamentals-enums/schema.ts` reads `// Object-form enum: values are defined inline` — it
    is the **array** form, so the comment is wrong. It sits above `#region` so it is **not**
    included in the page, but it should be fixed to avoid misleading a reader of the example file.
- **L12** "`as const` matters — without it Pothos infers `string[]` and you lose the
  literal-union type." **TRUE** — `const Values` + `ShapeFromEnumValues → Values[number]` (§1a,
  `builder.ts:504`, `types/builder-options.ts:96-100`).
- **L18-33** "Using the enum" — `Faction` objectRef exposing only `alignment` (via
  `t.field({ type: Alignment })`) and a `factions` query with an `Alignment` arg. Mechanically
  **TRUE** (`EnumRef` is both output and input ref, §1). **COHERENCE ISSUE vs the cast sheet:** the
  curriculum's canonical shape is `Faction { id, name, alignment, members }`, but **both** this
  mdx snippet (L19-23, only `alignment`) **and** the playground `IFaction`/`Faction`
  (`fundamentals-enums/schema.ts`: `{ id, name, alignment }`, exposes `id`/`name`/`alignment`)
  **omit `members`**. Not a code error, but the `Faction` here is a reduced cast shape — flag for
  cast-sheet alignment.
- **L35** arg runtime type "`'Good' | 'Neutral' | 'Evil' | null | undefined` — a literal union,
  not a string." **TRUE** — array-form input shape is `Values[number]` (§1a), nullable because the
  arg is optional.
- **L37-53** "Descriptions and deprecations" → switch to the **object form**, keys drive both
  GraphQL value names and the TS union. **TRUE** (§1b, §3). The example adds a 4th value `Chaotic`
  with a `deprecationReason` — illustrative only, not in the cast (fine).
  - **L53** "Anything past `description` and `deprecationReason` is rarely worth using." —
    editorial and **arguably understates `value`**, which is the whole point of the name-vs-value
    gotcha (§2). Not false, but a reader relying on it would miss `value`. Consider softening.
- **L55-71** "Backing with a TypeScript enum" — `enum Alignment { Good = 'GOOD', … }` then
  `builder.enumType(Alignment, { name: 'Alignment' })`. Signature is **TRUE** (§1d: name required,
  passed via options).
  - **L71 WRONG / MISLEADING:** "The runtime values (`'GOOD'`, etc.) become the GraphQL enum
    values." The GraphQL enum **value names** (what the client sees and what appears in the SDL)
    are the **keys** `Good | Neutral | Evil` (proven `tests/enums.test.ts:38-45` "uses keys",
    `:108-114`; mechanism `utils/enums.ts:39` `value: Enum[key]` + `build-cache.ts:720`). `'GOOD'`
    becomes the **internal backing `value`** — what your resolver returns and what args are parsed
    to — **not** the value clients see. As written the sentence conflates the two halves of the
    §2 gotcha and tells the reader the opposite of what introspection shows. Suggested fix: "The
    keys (`Good`, `Neutral`, `Evil`) are the GraphQL enum values clients use; the enum's runtime
    values (`'GOOD'`, …) are the backing values your resolvers return and receive."
- **L73-75** Callout cross-links to Scalars / Arguments — fine.

**WRONG claims found in enums.mdx:** **1 substantive** — L71 inverts the name-vs-value mapping for
TS-enum backing. **Plus** 1 coherence gap (Faction missing `members` vs cast, L18-33 + playground)
and 1 playground-source comment defect (`// Object-form enum` over an array-form region).

---

## 5. Docs-writing guidance (grounded)

- Teach the name-vs-value split explicitly (§2): array form ⇒ resolver value *is* the enum-value
  name; object-`value`/TS-enum ⇒ resolver value is the backing `value`, clients always use the
  key name. This is the single most confusion-prone fact on the page.
- If the cast sheet mandates `Faction { id, name, alignment, members }`, add `members` to the
  playground `IFaction`/`Faction` and the L18-33 snippet, or note the reduction deliberately.
- Keep `as const` in every array/object-map example (§1a) — it is load-bearing for the union type.
- Prefer the array form as the default (it avoids the gotcha entirely); reserve TS-enum backing
  for "you already have a TS enum," and when you show it, correct the L71 claim.

## 6. UNRESOLVED / UNVERIFIED

- **NOTE (not a defect):** the bare-string entries in an object value map (`utils/enums.ts:21-25`)
  are accepted at runtime but undocumented and untyped as a first-class form — recorded so a docs
  writer does not present it as supported API.
- **UNVERIFIED (exact wording):** the literal graphql-js runtime error when a resolver returns a
  value with no matching enum `value`. Mechanism is graphql-js serialization on the
  `GraphQLEnumType` built at `build-cache.ts:733-741`; the specific message string was not captured
  by running a failing query.
