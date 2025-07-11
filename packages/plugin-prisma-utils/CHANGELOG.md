# @pothos/plugin-prisma-utils

## 1.3.2

### Patch Changes

- 1622740: update dependencies

## 1.3.1

### Patch Changes

- cd7f309: Update dependencies

## 1.3.0

### Minor Changes

- 9cfb6a7: cache input mappings accross resolvers to reduce memory ussage in large schemas

## 1.2.0

### Minor Changes

- 27af377: replace eslint and prettier with biome

## 1.1.1

### Patch Changes

- Updated dependencies [307340a]
- Updated dependencies [307340a]
  - @pothos/plugin-prisma@4.1.0

## 1.1.0

### Minor Changes

- 50c7e40: Add prismaCreateMany helper

## 1.0.6

### Patch Changes

- 4736cd2: Fix typing for list column inputs defined with t.field

## 1.0.5

### Patch Changes

- Updated dependencies [094396d]
  - @pothos/plugin-prisma@4.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [a95bd0a]
  - @pothos/plugin-prisma@4.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [777f6de]
  - @pothos/core@4.0.2
  - @pothos/plugin-prisma@4.0.3

## 1.0.2

### Patch Changes

- 9bd203e: Fix graphql peer dependency version to match documented minumum version
- Updated dependencies [9bd203e]
  - @pothos/core@4.0.1
  - @pothos/plugin-prisma@4.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [132a2a5]
  - @pothos/plugin-prisma@4.0.1

## 1.0.0

### Minor Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- c1e6dcb: update readmes
- Updated dependencies [79139e8]
- Updated dependencies [c1e6dcb]
- Updated dependencies [b2de1f2]
- Updated dependencies [29841a8]
- Updated dependencies [bdcb8cd]
  - @pothos/plugin-prisma@4.0.0
  - @pothos/core@4.0.0

## 1.0.0-next.4

### Patch Changes

- update readmes
- Updated dependencies
  - @pothos/plugin-prisma@4.0.0-next.4
  - @pothos/core@4.0.0-next.1

## 1.0.0-next.3

### Patch Changes

- Updated dependencies [924ae0b]
  - @pothos/plugin-prisma@4.0.0-next.3

## 1.0.0-next.2

### Patch Changes

- Updated dependencies
  - @pothos/plugin-prisma@4.0.0-next.2

## 1.0.0-next.1

### Patch Changes

- Updated dependencies
  - @pothos/plugin-prisma@4.0.0-next.1

## 1.0.0-next.0

### Minor Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- Updated dependencies [29841a8]
  - @pothos/plugin-prisma@4.0.0-next.0
  - @pothos/core@4.0.0-next.0

## 0.14.1

### Patch Changes

- 1ecea46: revert accidental pinning of graphql peer dependency

## 0.14.0

### Minor Changes

- c50eafa: Update AND/OR/NOT on prismaWhere to accept Type or Field refs.

  Previously these fields accepted options directly, but will now require a full field definition
  (`t.field(options)`) to override the field options. This enables providing a separate subset of
  options for And/Or/Not.

## 0.13.0

### Minor Changes

- 4a11ce04: Allow filters to set null for not

## 0.12.1

### Patch Changes

- 8598e34f: Allow filters to set null for equals, is and isNot

## 0.12.0

### Minor Changes

- 5061fc0c: Fix disconnect/delete for relationUpdates for one:one relations

## 0.11.0

### Minor Changes

- c7756128: Improve typing for t.expose methods when strict mode is disabled

## 0.10.0

### Minor Changes

- ccdec047: Add prismaIntAtomicUpdate helper for atomic operations on ints during an update

### Patch Changes

- 9b80756a: Allow nulls in prismaWhere for nullable fields to allow filtering for rows where a
  column is null

## 0.9.0

### Minor Changes

- 2d2edce6: Allow `mode` field in generated Prisma filter types

## 0.8.2

### Patch Changes

- 624f2d05: Fix issue that prevented prismaUpdate from setting values to null

## 0.8.1

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 0.8.0

### Minor Changes

- e5295551: Add initial support for mutation input in prisma utils
- 72bd678a: This change adds new methods for creating create and update input types

  These new features require enabling a new flag in the pothos generator in your `prisma.schema`

  ```
  generator pothos {
    provider     = "prisma-pothos-types"
    // Enable prismaUtils feature
    prismaUtils  = true
  }
  ```

  See the update README.md for full details

## 0.7.0

### Minor Changes

- 07bf6d4f: Simplify how relations are defined in PrismaTypes

## 0.6.0

### Minor Changes

- bf0385ae: Add new PothosError classes

## 0.5.0

### Minor Changes

- cd1c0502: Add support for nested lists

## 0.4.7

### Patch Changes

- d4d41796: Update dev dependencies

## 0.4.6

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 0.4.5

### Patch Changes

- b12f9122: Fix issue with esm build script

## 0.4.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 0.4.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 0.4.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 0.4.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 0.4.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 0.3.1

### Patch Changes

- aa18acb7: update dev dependencies

## 0.3.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 0.2.0

### Minor Changes

- 8b31b25a: support search filters and AND/OR/NOT on prismaWhere

## 6.0.0

### Minor Changes

- 50a60d92: Support prisma filtered relations counts

### Patch Changes

- e297e78a: Support typescript@4.8
- Updated dependencies [e297e78a]
- Updated dependencies [50a60d92]
  - @pothos/plugin-prisma@3.31.0

## 5.0.0

### Patch Changes

- Updated dependencies [521cde32]
  - @pothos/plugin-prisma@3.30.0

## 4.0.0

### Patch Changes

- Updated dependencies [76d50bb4]
  - @pothos/plugin-prisma@3.29.0

## 3.0.0

### Patch Changes

- Updated dependencies [390e74a7]
  - @pothos/plugin-prisma@3.28.0

## 2.0.2

### Patch Changes

- Updated dependencies [193ac71a]
  - @pothos/plugin-prisma@3.27.2

## 2.0.1

### Patch Changes

- Updated dependencies [222298f0]
  - @pothos/plugin-prisma@3.27.1

## 2.0.0

### Minor Changes

- c5b1e2d3: Only use abstractReturnShapeKey when resolveType is not provided

### Patch Changes

- Updated dependencies [c5b1e2d3]
- Updated dependencies [c5b1e2d3]
  - @pothos/plugin-prisma@3.27.0

## 1.0.0

### Patch Changes

- Updated dependencies [5423703a]
  - @pothos/plugin-prisma@3.26.0

## 0.1.1

### Patch Changes

- 48a97010: Fix types field in package.json

## 0.1.0

### Minor Changes

- 7de5af50: Use \${Type}Filter as default name for prismaWhere
