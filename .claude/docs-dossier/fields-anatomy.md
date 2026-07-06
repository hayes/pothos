# Dossier: Fields — anatomy

Technical reference for docs writers. Territory: every place fields can be
defined; the field options catalog; expose helpers and their typing; how
parent/args/ctx/return types are derived (type-level, precisely). All paths are
relative to `packages/`. "Type-level" = compile-time only; "runtime" = what the
resolver/config actually does at build/execution time. Claims marked
`RECOMMEND` are docs stances (from the ledger or source-evident); everything
else is "what the code does."

Ledger items resolved here: **F3** (what `implement` is), and supporting
source for **F4** (class-backed abstract resolution) and **F2/S1** framing where
they touch field parent shapes. F1 is schema-builder territory (deferred).

---

## 1. Where fields can be defined — the complete surface

There are two families: **type-definition calls that accept a `fields` function**
and **standalone add-fields calls on the builder**. Both funnel field creation
through a *field builder* instance (`t`) whose class is chosen by field kind.

### 1a. `fields` function on a type-definition call

- `builder.objectType(param, options, fields?)` — `fields` is an optional 3rd
  positional arg; `options.fields` is an equivalent 2nd path. Both are run.
  `core/src/builder.ts:150` signature; `core/src/builder.ts:188-198` runs both:
  `if (fields) ref.addFields(() => fields(new ObjectFieldBuilder(...)))` then
  `if (options.fields) ref.addFields(() => { const t = new ObjectFieldBuilder(...); return options.fields!(t); })`.
  → Load-bearing: passing fields BOTH positionally and via `options.fields`
  registers two field maps (both applied); they are not mutually exclusive.
- `builder.queryType(options?, fields?)` — `core/src/builder.ts:226`; runs
  `fields` (`:250-252`) and `options.fields` (`:254-256`) against a
  `QueryFieldBuilder`.
- `builder.mutationType(options?, fields?)` — `core/src/builder.ts:271`;
  `MutationFieldBuilder` at `:296` / `:300`.
- `builder.subscriptionType(options?, fields?)` — `core/src/builder.ts:318`;
  `SubscriptionFieldBuilder` at `:346` / `:352`.
- `builder.interfaceType(param, options, fields?)` — `core/src/builder.ts` (sig
  near `:383`); `InterfaceFieldBuilder` at `:437` / `:441`.
- `ImplementableObjectRef.implement(options)` — `core/src/refs/object.ts:49-64`.
  See §2 for the F3 split.
- `builder.inputType(...).fields` — input objects only (`InputFieldBuilder`,
  kind `'InputObject'`); out of scope for output fields but shares the options
  machinery (§6).

`options.fields` for object types is typed as
`fields?: ObjectFieldsShape<Types, Shape>` on `ObjectTypeOptions`
(`core/src/types/global/type-options.ts:48`). `ObjectFieldsShape` =
`(t: ObjectFieldBuilder<Types, Shape>) => FieldMap`
(`core/src/types/builder-options.ts:107-109`). `FieldMap` =
`Record<string, GenericFieldRef<unknown>>` (`:147`).

### 1b. Standalone add-fields calls on the builder

These attach fields to an already-referenced type without re-declaring it:

- `builder.objectFields(param, fields)` — `core/src/builder.ts:205`; calls
  `this.configStore.addFields(param, () => fields(new ObjectFieldBuilder(...)))`.
- `builder.objectField(param, fieldName, fieldThunk)` — single field;
  `core/src/builder.ts:215`; thunk returns one `GenericFieldRef`
  (`ObjectFieldThunk`, `builder-options.ts:127-129`).
- `builder.queryFields(fields)` / `builder.queryField(name, thunk)` —
  `core/src/builder.ts:261` / `:265`.
- `builder.mutationFields(fields)` / `builder.mutationField(name, thunk)` —
  `core/src/builder.ts:308` / `:313`.
- `builder.subscriptionFields(fields)` / `builder.subscriptionField(name, thunk)` —
  `core/src/builder.ts:360` / `:367`.
- `builder.interfaceFields(ref, fields)` / `builder.interfaceField(ref, name, thunk)` —
  `core/src/builder.ts:447` / near `:460`.

Runtime note: all of these are thin wrappers over
`configStore.addFields(ref, thunkReturningFieldMap)` — field definition is
deferred (lazy) and merged; there is no ordering dependency between a type's
declaration and a later `*Fields`/`*Field` call. `TypeRefWithFields.addFields`
stores each thunk in a `Set` and replays `onField` callbacks
(`core/src/refs/base-with-fields.ts:30-40`). Duplicate field names across thunks
throw at build: `Duplicate field ${fieldName} on ${config.name}`
(`core/src/config-store.ts:177`).

### 1c. The field builder (`t`) class hierarchy

Every `t` handed to a `fields` function is one of these, all sharing one method
set via inheritance:

- `BaseFieldUtil<Types, ParentShape, Kind>` — `core/src/fieldUtils/base.ts:16`;
  holds `createField` / `exposeField` (the runtime factory, §5).
- `RootFieldBuilder` extends `BaseFieldUtil` — `core/src/fieldUtils/root.ts:17`;
  adds `t.field`, the scalar helpers (`t.string`/`t.int`/…), list scalar
  helpers, `t.arg`, `t.listRef`.
- `FieldBuilder` extends `RootFieldBuilder` — `core/src/fieldUtils/builder.ts:14`;
  adds the `t.expose*` family (§4).
- Kind-specific subclasses set `kind` + `graphqlKind` in their constructor:
  - `ObjectFieldBuilder` extends `FieldBuilder<…,'Object'>`,
    `super(builder,'Object','Object')` — `core/src/fieldUtils/object.ts`.
  - `InterfaceFieldBuilder` extends `FieldBuilder<…,'Interface'>`,
    `super(builder,'Interface','Interface')` — `core/src/fieldUtils/interface.ts`.
  - `QueryFieldBuilder` / `MutationFieldBuilder` / `SubscriptionFieldBuilder`
    extend **`RootFieldBuilder`** (NOT `FieldBuilder`),
    `super(builder,'Query','Object')` etc. —
    `core/src/fieldUtils/{query,mutation,subscription}.ts`.
  - Load-bearing consequence: **`t.expose*` is unavailable on Query / Mutation /
    Subscription field builders** because they extend `RootFieldBuilder`, which
    does not define the expose methods. Object and Interface field builders have
    them. (Verify against `object.ts`/`query.ts` — the `extends` clause differs.)

The public type names (`ObjectFieldBuilder`, `QueryFieldBuilder`, …) are the
declaration-merged `PothosSchemaTypes.*` interfaces, which extend the internal
classes — `core/src/types/global/classes.ts:33-59`. Plugins augment the *type*
surface by re-opening these interfaces (§7).

---

## 2. `implement` and the object-options split (ledger F3)

**F3 (binding):** `implement` is NOT "where fields go"; it takes the *remaining*
options for an object type, of which `fields` is one.

Source-precise account:

- `ImplementableObjectRef.implement(options)` forwards to
  `builder.objectType(this, options)` — `core/src/refs/object.ts:55`:
  `return this.builder.objectType(this, options as ObjectTypeOptions<…>)`.
  It passes NO separate positional `fields` argument, so any fields supplied via
  `implement` arrive as `options.fields`.
- The `options` type is
  `Omit<ObjectTypeOptions<Types, ImplementableObjectRef<…>, Parent, Interfaces>, 'name'>`
  — `core/src/refs/object.ts:50-53`. `name` is omitted because the ref already
  carries it.
- So the split is: **ref creation** (`builder.objectRef<T>(name)` at
  `core/src/builder.ts:685`, or a class, or a `SchemaTypes`-registered string
  name) fixes the type's *name* and *shape*; **`implement`** supplies everything
  else — `fields`, `description`, `interfaces`, `isTypeOf`, `extensions`,
  `astNode`. These "everything else" options are exactly the members of
  `ObjectTypeOptions` / `ObjectTypeWithInterfaceOptions`
  (`core/src/types/global/type-options.ts:46-62`):
  - `fields?: ObjectFieldsShape<Types, Shape>` (`:48`)
  - `description?: string` (via `BaseTypeOptions`, `:34`)
  - `extensions?` (`:35`), `astNode?: ObjectTypeDefinitionNode` (`:50`)
  - `isTypeOf?: GraphQLIsTypeOfFn<unknown, Types['Context']>` (`:51`)
  - `interfaces?` (`ObjectTypeWithInterfaceOptions`, `:59-61`)
- `RECOMMEND` (from F3): docs must state explicitly that object options are
  split across two calls — the ref/name/shape at creation, the rest at
  `implement` — rather than implying `implement` is a fields container. Same
  `options` object shape is accepted inline as the 2nd arg of
  `builder.objectType(param, options, fields?)`; `implement` is the
  ref-first spelling of the identical options bag.

---

## 3. The field-options catalog (output fields)

The base option interface is `PothosSchemaTypes.FieldOptions`
(`core/src/types/global/field-options.ts:51-77`). **Note: `resolve` is NOT in
this interface** — it is layered in separately (§3b). Base members:

| Option | Type (source) | Runtime effect | Cite |
|---|---|---|---|
| `type` | `Type` (a `TypeParam`) — required | Resolved to a `PothosOutputFieldType` via `typeFromParam` | `field-options.ts:61`; `base.ts:70-74` |
| `args` | `Args extends InputFieldMap`, optional | Each `ArgumentRef` `.getConfig(...)` builds a `PothosInputFieldConfig` | `field-options.ts:63`; `base.ts:46-55` |
| `nullable` | `Nullable extends FieldNullability<Type>`, optional | `options.nullable ?? builder.defaultFieldNullability` | `field-options.ts:65`; `base.ts:72-73` |
| `description` | `string`, optional | Copied to field config `.description` | `field-options.ts:67`; `base.ts:81` |
| `deprecationReason` | `string`, optional | Copied to `.deprecationReason` | `field-options.ts:69`; `base.ts:82` |
| `extensions` | `GraphQLFieldExtensions<ParentShape, Context, InputShapeFromFields<Args>>`, optional | Merged into config `.extensions`, plus `pothosOriginalResolve`/`pothosOriginalSubscribe` injected | `field-options.ts:71-75`; `base.ts:76-80` |
| `astNode` | `FieldDefinitionNode`, optional | Copied to `.astNode` | `field-options.ts:76`; `base.ts:85` |

- `type` accepts a single `TypeParam` or a one-tuple `[TypeParam]` for a list —
  `TypeParam<Types> = OutputType<Types> | [OutputType<Types>]`
  (`core/src/types/type-params.ts:114`). List nesting deeper than one level is
  expressed with `t.listRef` (`core/src/fieldUtils/root.ts:409`) or nested refs,
  not by `[[...]]`.
- `nullable` for a list type may be a boolean or
  `{ list: boolean; items: boolean }` to control the two null positions
  independently — `FieldNullability<Param>` (`type-params.ts:198-207`); the
  object form only applies when `Param extends [unknown]`.

### 3a. `subscribe` (subscription fields only)

- `SubscriptionFieldOptions` extends `FieldOptions` and adds a **required**
  `subscribe: Subscriber<Root, InputShapeFromFields<Args>, Context, ResolveShape>`
  — `core/src/types/global/field-options.ts:145-174`.
- `Subscriber` returns `MaybePromise<AsyncIterable<Shape>>`
  (`core/src/types/builder-options.ts:82-87`).
- Type-level: the value yielded by `subscribe` becomes the `ResolveShape` fed to
  the subscription's `resolve` parent (see §8). Runtime: `subscribe` is stored on
  the config and echoed to `extensions.pothosOriginalSubscribe`
  (`core/src/fieldUtils/base.ts:62`, `:78`).

### 3b. `resolve` — layered in, not a base option (the InferredFieldOptions mechanism)

`resolve` is contributed by `InferredFieldOptions`, then intersected onto the
per-kind options:

- `InferredFieldOptions<Types, ResolveShape, Type, Nullable, Args, ResolveReturnShape>`
  has one key by default, `Resolve`, whose `.resolve` is
  `Resolver<ResolveShape, InputShapeFromFields<Args>, Context, ShapeFromTypeParam<Types, Type, Nullable>, ResolveReturnShape>`
  — `core/src/types/global/field-options.ts:25-49`.
- `FieldOptionsByKind[Kind]` intersects the kind's base options with
  `InferredFieldOptionsByKind<Types, Types['InferredFieldOptionsKind'], …>`
  — `core/src/types/global/field-options.ts:176-251`. `InferredFieldOptionsByKind`
  indexes `InferredFieldOptions` by `Types['InferredFieldOptionsKind']`
  (`core/src/types/builder-options.ts:338-353`).
- Default `Types['InferredFieldOptionsKind']` = `'Resolve'`
  (`core/src/types/global/schema-types.ts:81-83`), so by default the merged
  options require a `resolve` function — for **Object, Query, Mutation,
  Subscription** kinds.
- **Interface is the exception**: its inferred options are wrapped in
  `Partial<...>` — `core/src/types/global/field-options.ts:232-250`
  (`Interface: InterfaceFieldOptions<…> & Partial<InferredFieldOptionsByKind<…>>`).
  → Load-bearing: **interface fields do not require a `resolve`** at the type
  level. Runtime: with no resolver, graphql's `defaultFieldResolver` reads the
  property off the parent (via `pothosOriginalResolve` being undefined → config
  `.resolve` undefined → graphql default).
- Plugins can *replace* the resolver contract by adding a new key to
  `InferredFieldOptions` and setting `InferredFieldOptionsKind` to it. Example:
  `plugin-grafast` adds a `Grafast` key whose member is
  `{ resolve?: never; plan: (step, args) => Step<...> }`
  (`plugin-grafast/src/global-types.ts:51-68`) — under that kind, `resolve` is
  forbidden and a `plan` is required instead. This is the sanctioned mechanism
  for swapping what "the resolver option" means globally.

### 3c. `Resolver` return typing (runtime-relevant type math)

`Resolver<Parent, Args, Context, Type, Return>` —
`core/src/types/builder-options.ts:44-51`:
```ts
(parent, args, context, info) =>
  [Type] extends [readonly (infer Item)[] | null | undefined]
    ? ListResolveValue<Type, Item, Return>
    : MaybePromise<Type>
```
- Non-list fields: return `MaybePromise<Type>` where `Type =
  ShapeFromTypeParam<Types, Type, Nullable>`.
- List fields: `ListResolveValue` (`:53-64`) permits returning an array, a
  (sync) `Iterable`, or an `AsyncIterable` of items, each optionally promised,
  and threads item-nullability through. This is why a list resolver may return,
  e.g., an async generator.
- `Return` is the `ResolveReturnShape` generic, inferred from the actual return
  expression; it lets Pothos accept ref-returning resolvers where the ref's
  shape matches `Type`.

---

## 4. Expose helpers (`t.expose*`) and their typing

Defined on `FieldBuilder` — `core/src/fieldUtils/builder.ts`. Members:
`exposeString`, `exposeInt`, `exposeFloat`, `exposeBoolean`, `exposeID`
(`:24-192`), their list forms `exposeStringList`/`exposeIntList`/`exposeFloatList`/
`exposeBooleanList`/`exposeIDList` (`:194-367`), and the generic
`expose<Type,…>(name, options)` (`:374-416`).

### 4a. Signature shape

Each typed helper is `exposeX(name, options?)`:
- `name` is constrained to `CompatibleTypes<Types, ParentShape, Type, Nullable>`
  — the set of parent keys whose (awaited) value is assignable to the field's
  shape (`core/src/types/builder-options.ts:284-298`):
  ```ts
  { [K in keyof ParentShape]-?:
      Awaited<ParentShape[K]> extends ShapeFromTypeParam<Types,Type,Nullable> ? K : never
  }[keyof ParentShape] & string
  ```
  → Load-bearing: `t.exposeString('x')` only type-checks if `ParentShape['x']`
  is a `string` (per the field's nullability). Promise-valued properties are
  allowed (`Awaited<...>`).
- `options` is `NormalizeArgs<[ExposeNullability<...> & Omit<FieldOptions…,
  'nullable'|'type'|InferredFieldOptionKeys>]>`
  (`builder.ts:30-47` for boolean; same shape for each).
  - `'type'` is omitted — the helper hard-codes it (`{ ...options, type:
    'Boolean' }`, `builder.ts:51`).
  - `InferredFieldOptionKeys` is omitted — this strips `resolve`
    (`core/src/types/builder-options.ts:355-361`;
    `InferredFieldOptionKeys` = the keys of `InferredFieldOptions[Kind]`, i.e.
    `'resolve'` by default). → **You cannot pass `resolve` to `t.expose*`**; the
    resolver is synthesized (§5).
  - `nullable` is omitted from the base and re-added by `ExposeNullability`.

### 4b. `ExposeNullability` — nullable becomes required when the property is nullable

`core/src/types/builder-options.ts:300-333`:
```ts
Awaited<ParentShape[Name]> extends ShapeFromTypeParam<Types,Type,Nullable>
  ? { nullable?: ExposeNullableOption<...> & Nullable }   // optional
  : { nullable:  ExposeNullableOption<...> & Nullable }   // REQUIRED
```
→ Load-bearing: if the backing property can be `null`/`undefined` but the field
type param is non-nullable, TypeScript forces you to pass `nullable` (and
`ExposeNullableOption`, `:315-333`, computes the exact allowed nullable value,
including the `{items, list}` form for list properties). This is how expose stays
sound without a resolver.

### 4c. The generic `t.expose(name, options)`

`core/src/fieldUtils/builder.ts:374-416`. Unlike the typed helpers, `type` is
**kept** in `options` (the Omit only removes `'nullable' | InferredFieldOptionKeys`,
`:400`) — you supply the type explicitly. `name` is
`Name extends keyof ParentShape ? Name : keyof ParentShape` (`:385`), constrained
by the same `CompatibleTypes` computation, with the list/non-list requiredness
selector `Type extends [unknown] ? { list: true; items: true } : true`
(`:381-383`).

### 4d. Expose runtime (§ shared with §5)

All `t.expose*` route through `BaseFieldUtil.exposeField`
(`core/src/fieldUtils/base.ts:93-112`), which:
1. sets `extensions.pothosExposedField = name` (the *property* name),
2. sets `resolve: (parent) => parent[name]`.

---

## 5. Runtime field factory — `createField` / `exposeField`

`BaseFieldUtil.createField` (`core/src/fieldUtils/base.ts:33-91`) is the single
runtime path all output-field methods reach. It returns a lazy `FieldRef` whose
`initConfig(name, typeConfig)` computes a `PothosOutputFieldConfig`
(`FieldRef` — `core/src/refs/field.ts`). Key runtime steps:

- Args: each entry of `options.args` is an `ArgumentRef`; `.getConfig(argName,
  fieldName, typeConfig)` produces its input-field config
  (`base.ts:46-55`).
- Type: `type: typeFromParam(options.type, configStore, options.nullable ??
  builder.defaultFieldNullability)` (`base.ts:70-74`). → the field's nullability
  is decided here, at build, from the option or the builder default.
- Resolver: `let { resolve } = options` (`base.ts:57`). Then the exposed-field
  fast path: `if (options.extensions?.pothosExposedField === name) resolve =
  defaultFieldResolver` (`base.ts:59-61`). → Load-bearing subtlety: for an
  exposed field, if the **graphql field name equals the property name**, Pothos
  swaps the `(parent)=>parent[name]` closure for graphql's `defaultFieldResolver`
  (`import { defaultFieldResolver } from 'graphql'`, `base.ts:1`). If field name
  ≠ property name, the property-reading closure from `exposeField` is kept. Both
  are pure property reads; the swap is an equivalence optimization, not a
  behavior change.
- Extensions: config `.extensions` = `{ pothosOriginalResolve: resolve,
  pothosOriginalSubscribe: subscribe, ...options.extensions }`
  (`base.ts:76-80`). Plugins read `pothosOriginalResolve` to wrap resolvers.
- The returned `FieldRef` is added to a type's `FieldMap`; config is finalized
  lazily via `FieldRef.getConfig` (`core/src/refs/field.ts`), applying any
  `updateConfig` pending actions (plugin hooks).

`t.field` (`core/src/fieldUtils/root.ts:388-407`) calls `createField` directly
with the caller-supplied `options` (including `type`). The scalar helpers
(`t.boolean`/`t.float`/`t.id`/`t.int`/`t.string`, `root.ts:28-202`) and list
scalar helpers (`t.booleanList`…`t.stringList`, `root.ts:208-382`) each spread
`{ ...options, type: 'X' }` (or `['X']`) into `createField`, using
`DistributeOmit<…, 'type'>` so the caller cannot restate `type`.

---

## 6. Arguments (`t.arg`) and the args→shape derivation

- `t.arg` on a field builder is `RootFieldBuilder.arg`, an `ArgBuilder<Types>`
  built from `new InputFieldBuilder<Types,'Arg'>(builder,'Arg').argBuilder()`
  (`core/src/fieldUtils/root.ts:22`). `builder.args(fn)` gives the same builder
  standalone (`core/src/builder.ts` `args<Shape>`, near `:373`).
- `ArgBuilder` = the callable `field` method plus the typed helpers
  (`t.arg.string()`, `t.arg.int()`, …, list forms, `t.arg.listRef`) —
  `core/src/types/builder-options.ts:215-219`;
  helpers created by `InputFieldBuilder.helper` (`core/src/fieldUtils/input.ts:175-188`).
- Arg option interface: `ArgFieldOptions extends InputFieldOptions`
  (`core/src/types/global/field-options.ts:273-277`). `InputFieldOptions`
  (`:253-271`) members: `type` (required), `required?`, `defaultValue?`
  (`InputShapeFromTypeParam<Types,Type,Req>`), `description?`,
  `deprecationReason?`, `extensions?`, `astNode?`. Note the input-side knob is
  **`required`** (not `nullable`); default `required` =
  `builder.defaultInputFieldRequiredness` (`core/src/fieldUtils/input.ts:139-140`).
- Type-level args shape: a field's `args` option is an `InputFieldMap` =
  `Record<string, ArgumentRef>`. The resolver receives
  `InputShapeFromFields<Args>` =
  `NormalizeNullableFields<{ [K]: InputShapeFromField<Args[K]> }>`
  (`core/src/types/builder-options.ts:245-247`), i.e. each arg key mapped to the
  ref's carried input shape, with nullable keys made optional.

---

## 7. Plugin-added field methods — the augmentation mechanism

Plugins do not subclass the field builders; they **re-open the merged
interfaces** and (separately) patch the prototypes.

- Type surface: a plugin declares `declare global { namespace PothosSchemaTypes {
  interface RootFieldBuilder<Types, ParentShape, Kind> { … } } }`. Because the
  public `RootFieldBuilder`/`FieldBuilder`/`ObjectFieldBuilder`/… interfaces are
  the ones every `t` is typed as (`core/src/types/global/classes.ts:33-59`), any
  method added to `RootFieldBuilder` appears on every kind's `t`, and a method
  added to `FieldBuilder` appears only on Object/Interface `t`.
  - Example — relay adds `globalID`, `globalIDList`, `node`, `nodeList`,
    `connection` to `RootFieldBuilder`
    (`plugin-relay/src/global-types.ts:262-315`), so they are available on
    Query/Mutation/Object/etc. field builders.
- Runtime surface: plugins assign the actual method onto the field-builder
  prototype at import time (each plugin's field-builder patch file). The typed
  interface and the runtime method must be kept in lockstep by the plugin;
  from the docs' perspective the method simply exists on `t`.
- Field-option augmentation: plugins commonly define their own option types that
  extend/compose `FieldOptionsFromKind` + `InferredFieldOptionsByKind` so their
  method carries the standard resolver contract. Example: federation composes
  `InferredFieldOptionsByKind<Types, Types['InferredFieldOptionsKind'], …>` into
  its options (`plugin-federation/src/global-types.ts:54-56`).
- Cross-reference: enumerating every plugin's `t.*` method is the ORM /
  relay / errors / dataloader dossiers' territory; this dossier fixes the
  *mechanism* only.

---

## 8. Parent / args / context / return derivation (type-level, precise)

This is the exact chain — no "walks your code" framing. The parent type is fixed
when the field builder is constructed, from the type param passed to the
type-definition call.

### 8a. Which `ParentShape` a `t` carries

- `builder.objectType(param, …)` builds `new ObjectFieldBuilder<Types,
  ParentShape<Types, Param>>(this)` (`core/src/builder.ts:189`,`:194`). So the
  `t.*` parent is `ParentShape<Types, Param>` for the `param` you passed.
- Same for `objectFields`/`objectField` (`:211`,`:222`),
  `interfaceType`/`interfaceFields`/`interfaceField`
  (`:437`/`:453`/near `:460`). Query/Mutation/Subscription builders are
  constructed with no explicit parent arg — their parent shape comes from the
  kind's options (§8c).
- `ParentShape<Types, T>` (`core/src/types/type-params.ts:33-37`):
  ```ts
  T extends { [parentShapeKey]: infer U } ? U : OutputShape<Types, T>
  ```
  - If `T` is a ref carrying an explicit parent brand (e.g.
    `ObjectRef<Types, T, P>` sets `[parentShapeKey]: P`,
    `core/src/refs/object.ts:30`), the parent is that `P`.
  - Otherwise it falls back to `OutputShape<Types, T>`.
- `OutputShape<Types, T>` (`core/src/types/type-params.ts:14-31`), in order:
  1. `T extends { [outputShapeKey]: infer U }` → `U` (an `ObjectRef`/`InterfaceRef`
     carrying its shape).
  2. `T extends new (...args) => infer U` → the class **instance type** `U`
     (unwrapping a nested `[outputShapeKey]` if present). This is the
     class-backed case: the parent is `InstanceType<Class>`.
  3. `T extends keyof Types['outputShapes']` → `Types['outputShapes'][T]` — the
     string-name case. `outputShapes` is assembled from registered
     `Scalars`/`Objects`/`Interfaces` generics
     (`core/src/types/global/schema-types.ts:94-102`). This is the
     `SchemaTypes`-registered ("builder types") path — cross-ref F2 / the
     schematypes-registration dossier: registering on `Objects`/`Interfaces` is
     how a *string* type name resolves to a parent shape; it is unrelated to ORM
     model-name wiring.
  4. `T extends BaseEnum` → the enum's value union.

### 8b. Resolver signature for a given field

For a field of kind K, the merged options include the `resolve` from
`InferredFieldOptions.Resolve` (§3b):
`resolve: Resolver<ResolveShape, InputShapeFromFields<Args>, Types['Context'],
ShapeFromTypeParam<Types, Type, Nullable>, ResolveReturnShape>`
(`core/src/types/global/field-options.ts:41-47`). The four callback params map
exactly:
- **parent** = `ResolveShape` — see §8c for what fills it per kind.
- **args** = `InputShapeFromFields<Args>` — computed from the field's `args`
  option (§6).
- **context** = `Types['Context']` — the `Context` entry of the builder's
  `SchemaTypes` (`core/src/types/schema-types.ts:32`). Uniform across all fields;
  set once at `new SchemaBuilder<...>()`.
- **info** = `GraphQLResolveInfo` (graphql).
- **return** must satisfy `Resolver`'s computed type from
  `ShapeFromTypeParam<Types, Type, Nullable>` (§3c).

### 8c. What fills `ResolveShape` (the parent) per kind

Per `FieldOptionsByKind` (`core/src/types/global/field-options.ts:176-251`), the
`ResolveShape` passed into each kind's options is:
- **Object** → `ParentShape` (`ObjectFieldOptions` sets the 6th `FieldOptions`
  arg to `ParentShape`, `:79-94`, `:222-231`). Parent = the object's parent shape
  from §8a.
- **Interface** → `ParentShape` (`:128-143`, `:232-250`). Same.
- **Query** → `Types['Root']` (`QueryFieldOptions`, `:96-110`; `:185-194`).
- **Mutation** → `Types['Root']` (`MutationFieldOptions`, `:112-126`; `:195-204`).
- **Subscription** → a distinct `ResolveShape` generic (`:145-174`, `:205-221`)
  that is the item type yielded by the field's own `subscribe` (§3a). → the
  subscription `resolve`'s parent is the event value, not `Types['Root']`.

`Types['Root']` and `Types['Context']` come from the builder's `SchemaTypes`
(`core/src/types/schema-types.ts:31-32`); Root defaults to `object`.

### 8d. `ShapeFromTypeParam` — how `type`+`nullable` become the parent/return shape

`core/src/types/type-params.ts:156-196`. Given `Param` and `Nullable`:
- List param (`Param extends [OutputType]`) → `ShapeFromListTypeParam`
  (`:170-196`), producing `readonly Item[]` with the two null positions governed
  by `Nullable` (boolean or `{list, items}`).
- Non-list → `OutputShape<Types, Param>`, unioned with `null | undefined` when
  `Nullable` is `true` **or** when `Nullable` is the bare `boolean` type and
  `Types['DefaultFieldNullability']` is `true` (`:162-168`). This is the
  type-level counterpart of the runtime `nullable ?? defaultFieldNullability`.

---

## 9. Default nullability / requiredness (governs every field & arg)

- Runtime: `builder.defaultFieldNullability = options.defaultFieldNullability ??
  options.defaults !== 'v3'` (`core/src/builder.ts:115-120`). → In v4 (the
  default), **fields are nullable by default** (`true`); in `defaults: 'v3'`
  mode, non-nullable by default (`false`).
- Runtime: `builder.defaultInputFieldRequiredness =
  options.defaultInputFieldRequiredness ?? false`
  (`core/src/builder.ts:122-127`). → args/input fields are **optional by
  default** regardless of version.
- Type-level mirror: `DefaultFieldNullability` resolves to `true` in v4 (unless
  set `false`) and `false` in v3 (unless set `true`)
  (`core/src/types/global/schema-types.ts:84-90`);
  `DefaultInputFieldRequiredness` is `false` unless set `true` (`:91-93`).
- The per-field `Nullable` generic defaults to `Types['DefaultFieldNullability']`
  on the scalar/`field` helpers (e.g. `Nullable extends FieldNullability<'Boolean'>
  = Types['DefaultFieldNullability']`, `core/src/fieldUtils/root.ts:31`).
  Exceptions where the default generic is a bare `FieldNullability<...>` with no
  default (so it is inferred, effectively non-null unless `nullable` is passed):
  `t.float`, `t.id`, `t.int`, `t.idList` (`root.ts:65`,`:101`,`:137`,`:281`) —
  `t.boolean`, `t.string`, and the other list helpers do default to
  `Types['DefaultFieldNullability']`. `RECOMMEND`: verify each helper's default
  generic before documenting per-type nullability; they are not uniform.
  (Both `t.field` and the runtime resolve `options.nullable ??
  builder.defaultFieldNullability`, so the runtime default is uniform even where
  the type generic differs.)

---

## 10. Class-backed types and abstract resolution (ledger F4 — source check)

F4 (binding): class-backed object types don't just infer the backing model;
classes also enable resolving interfaces/unions via `instanceof`. Source-level
findings (this is primarily object-types/interfaces territory; recorded here
because it flows from the class → parent-shape derivation in §8a):

- Type-level: a class param's parent/output shape is its `InstanceType`
  (`OutputShape`, `core/src/types/type-params.ts:18-26`). So a `resolveType`/
  `isTypeOf` written over that parent narrows correctly with `instanceof`.
- Runtime: core does **not** auto-synthesize an `isTypeOf` from a class.
  `objectType` copies only `isTypeOf: options.isTypeOf`
  (`core/src/builder.ts:176`); there is no class→`instanceof` default in
  `builder.ts` or `build-cache.ts` (verified: the only field-config `isTypeOf`
  handling is `wrapIsTypeOf(config.isTypeOf ?? undefined, config)`,
  `core/src/build-cache.ts:564-566`). The interface/union `resolveType` falls
  back to graphql's `defaultTypeResolver` when the user supplies neither a type
  brand nor a `resolveType` (`build-cache.ts:588`,`:626`), and
  `defaultTypeResolver` consults each type's `isTypeOf`.
- Therefore the F4 affordance is: because the runtime parent is a real class
  instance, the user writes `isTypeOf: (v) => v instanceof MyClass` (or a
  `resolveType` using `instanceof`) and it Just Works, with correct type
  narrowing — it is a first-class, ergonomic pattern, but the `instanceof` check
  is authored by the user, not generated by core.
- UNRESOLVED (defer to object-types / interfaces dossier): whether any plugin
  (e.g. a class helper) auto-wires an `instanceof` `isTypeOf`. Checked
  `core/src` and `plugin-simple-objects/src` — no auto-wiring found; did not
  audit every plugin.

---

## 11. Anti-slop / editorial notes bearing on this territory

- `RECOMMEND` (F3): when documenting `implement`, state the ref-creation vs
  `implement`-options split concretely (§2), not "implement is where fields go."
- `RECOMMEND` (S1): present objectRef, class-backed, and `SchemaTypes`-registered
  parent-shape paths (§8a cases 1–3) as co-equal; the type derivation treats them
  as three branches of one function, so do not rank them.
- `RECOMMEND` (A3): do not summarize the options catalog as a verb list ("expose
  properties, mark nullable, compute values"); document each option by its type
  and runtime effect (§3 table).
- When docs say "the resolver's `parent`/`args`/`context`," anchor each to §8b's
  exact generic — they are fixed positions in `Resolver`, not inferred by
  analysis of the resolver body.
