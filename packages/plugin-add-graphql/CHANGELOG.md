# @pothos/plugin-add-graphql

## 4.3.4

### Patch Changes

- 76637b4: Preserve custom query, mutation, and subscription root roles when the same types are imported through both `add.schema` and `add.types`.

## 4.3.3

### Patch Changes

- 82c4721: Preserve GraphQL 17 SDL and external-value defaults when importing arguments and input fields.
- 8b71b75: Import fields whose names match Object.prototype properties unless explicitly overridden or removed.

## 4.3.2

### Patch Changes

- ddef6d4: Use the operation roles declared by an imported schema, including custom root names. Types named
  `Query`, `Mutation`, or `Subscription` are no longer promoted to roots unless the schema uses them
  for that operation. Existing builder roots are preserved, and an imported root is not reused for
  a second operation. Schemas without a query root still fall back to a type named `Query`.

  Add `rootKind` to `builder.addGraphQLObject`: choose an operation root or pass `null` to import a
  regular object. Standalone imports and `add: { types }` continue to infer roots from names when
  `rootKind` is omitted.

  Preserve `deprecationReason` on imported input fields.

  Merge fields from imported schema roots into configured types with the same name, retaining the
  configured type's description, extensions, and AST metadata. Configured fields take precedence over
  same-named imported fields, including inherited fields and overrides added after a schema build.
  Non-overlapping imported fields are retained. Explicit
  `addGraphQLObject` field overrides and removals are preserved. Merged fields use the destination's
  field kind, so root-field plugins apply. Non-root collisions and `add: { types }` behavior are
  unchanged, and repeated schema builds do not merge the same root again.

  Duplicate local field declarations and collisions through `queryFields()` without a configured
  root keep their existing errors. Root collisions with non-object types or different operation
  roots now throw, including on subsequent builds.

## 4.3.1

### Patch Changes

- 76e06e7: Rebuild with TypeScript 7. Source files now use explicit `.js` import extensions (enforced by
  lint) instead of adding them during the build, and declaration files are emitted by TypeScript
  7's compiler. Published output is functionally unchanged.

## 4.3.0

### Minor Changes

- 5b29d51: Add support for adding astNodes to types, fields, and enum values

## 4.2.4

### Patch Changes

- 1622740: update dependencies

## 4.2.3

### Patch Changes

- cd7f309: Update dependencies

## 4.2.2

### Patch Changes

- 4af88f1: correctly pass through isOneOf setting from native GraphQL input objects

## 4.2.1

### Patch Changes

- 7a4fa4c: Fix added subscription fields with custom subscribe method

## 4.2.0

### Minor Changes

- e6ca3fa: Support nested lists

## 4.1.0

### Minor Changes

- 27af377: replace eslint and prettier with biome

## 4.0.2

### Patch Changes

- Updated dependencies [777f6de]
  - @pothos/core@4.0.2

## 4.0.1

### Patch Changes

- 9bd203e: Fix graphql peer dependency version to match documented minumum version
- Updated dependencies [9bd203e]
  - @pothos/core@4.0.1

## 4.0.0

### Major Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- c1e6dcb: update readmes
- Updated dependencies [c1e6dcb]
- Updated dependencies [29841a8]
  - @pothos/core@4.0.0

## 4.0.0-next.1

### Patch Changes

- update readmes
- Updated dependencies
  - @pothos/core@4.0.0-next.1

## 4.0.0-next.0

### Major Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- Updated dependencies [29841a8]
  - @pothos/core@4.0.0-next.0

## 3.2.1

### Patch Changes

- 1ecea46: revert accidental pinning of graphql peer dependency

## 3.2.0

### Minor Changes

- 41fe7d4: Make options optional when registering existing scalars/types

## 3.1.1

### Patch Changes

- 425435af: Improve typing of inputRefs and fix incorrectly normalized function properties of
  inputRef types

## 3.1.0

### Minor Changes

- 27b0638d: Update plugin imports so that no named imports are imported from files with side-effects

## 3.0.2

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.0.1

### Patch Changes

- b5620c75: fix issue with extending root types

## 3.0.0

### Major Changes

- f9b0e2eb: Initial release
