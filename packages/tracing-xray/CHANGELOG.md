# @pothos/tracing-xray

## 1.1.0

### Minor Changes

- 27af377: replace eslint and prettier with biome

## 1.0.2

### Patch Changes

- Updated dependencies [777f6de]
  - @pothos/core@4.0.2
  - @pothos/plugin-tracing@1.0.2

## 1.0.1

### Patch Changes

- 9bd203e: Fix graphql peer dependency version to match documented minumum version
- Updated dependencies [9bd203e]
  - @pothos/core@4.0.1
  - @pothos/plugin-tracing@1.0.1

## 1.0.0

### Minor Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- c1e6dcb: update readmes
- Updated dependencies [c1e6dcb]
- Updated dependencies [29841a8]
  - @pothos/plugin-tracing@1.0.0
  - @pothos/core@4.0.0

## 1.0.0-next.1

### Patch Changes

- update readmes
- Updated dependencies
  - @pothos/plugin-tracing@1.0.0-next.1
  - @pothos/core@4.0.0-next.1

## 1.0.0-next.0

### Minor Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- Updated dependencies [29841a8]
  - @pothos/core@4.0.0-next.0
  - @pothos/plugin-tracing@1.0.0-next.0

## 0.5.9

### Patch Changes

- 1ecea46: revert accidental pinning of graphql peer dependency

## 0.5.8

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 0.5.7

### Patch Changes

- d4d41796: Update dev dependencies

## 0.5.6

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 0.5.5

### Patch Changes

- b12f9122: Fix issue with esm build script

## 0.5.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 0.5.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 0.5.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 0.5.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 0.5.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 0.4.1

### Patch Changes

- aa18acb7: update dev dependencies

## 0.4.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 0.3.2

### Patch Changes

- e297e78a: Support typescript@4.8

## 0.3.1

### Patch Changes

- 3ead60ae: update dev deps

## 0.3.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 0.2.4

### Patch Changes

- 7311904e: Update dev deps

## 0.2.3

### Patch Changes

- c8f75aa1: Update dev dependencies

## 0.2.2

### Patch Changes

- 4e5756ca: Update dev dependencies

## 0.2.1

### Patch Changes

- 4b24982f: Update dev dependencies

## 0.2.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 0.1.0

### Minor Changes

- b6b7e487: Add onSpan/onSegment to more trace providers
