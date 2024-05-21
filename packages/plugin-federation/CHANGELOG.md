# @pothos/plugin-federation

## 3.16.0

### Minor Changes

- 8164cba: Add label option to the @override directive

## 3.15.0

### Minor Changes

- b62b7ca: revert on asEntity method, and add a new method that accepts a selection and a resolvable
  boolean

## 3.14.1

### Patch Changes

- 0debcce: Exclude non resolveAble entities from Entity union

## 3.14.0

### Minor Changes

- a534c4a: Add a new resolvable option to asEntity to allow setting resolvable: false on an entities
  key directive

## 3.13.1

### Patch Changes

- e1b2a69: Fix incorrectly configured exports in package.json

## 3.13.0

### Minor Changes

- 126cd76: Allow imported federation directives to be manually configured, and only import used
  directives by default

## 3.12.0

### Minor Changes

- 0979efd: Update referenced version of Apollo Federation specs to v2.6

## 3.11.0

### Minor Changes

- 27b0638d: Update plugin imports so that no named imports are imported from files with side-effects

## 3.10.1

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.10.0

### Minor Changes

- 487b810a: Add support for @interfaceObject and @composeDirective

## 3.9.1

### Patch Changes

- dfe34dae: correctly set linkUrl

## 3.9.0

### Minor Changes

- bce97784: Add `linkUrl` option to buildSubGraphSchema

## 3.8.0

### Minor Changes

- 0eb6cb94: Update federation plugin to work with apollo/federation@2.3

## 3.7.0

### Minor Changes

- cd1c0502: Add support for nested lists

## 3.6.4

### Patch Changes

- d4d41796: Update dev dependencies

## 3.6.3

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 3.6.2

### Patch Changes

- b12f9122: Fix issue with esm build script

## 3.6.1

### Patch Changes

- d350f842: update dev deps

## 3.6.0

### Minor Changes

- 4c086637: print deprecated directives in schema sdl field

## 3.5.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 3.5.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 3.5.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 3.5.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 3.5.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 3.4.3

### Patch Changes

- aa18acb7: update dev dependencies

## 3.4.2

### Patch Changes

- e297e78a: Support typescript@4.8

## 3.4.1

### Patch Changes

- 3ead60ae: update dev deps

## 3.4.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 3.3.0

### Minor Changes

- c8ed6b03: Add @shareable @tag @inaccessible and @override directives

## 3.2.1

### Patch Changes

- 7311904e: Update dev deps

## 3.2.0

### Minor Changes

- c8f75aa1: Fix compatibility with latest @apollo/subgraph

### Patch Changes

- c8f75aa1: Update dev dependencies

## 3.1.1

### Patch Changes

- 4e5756ca: Update dev dependencies

## 3.1.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.0.0

### Major Changes

- 971f1aad: Initial stable release

### Patch Changes

- 971f1aad: Update dev dependencies

## 0.4.0

### Minor Changes

- 21a2454e: Update to apollo dependencies to preview.9 which includes some important fixes for
  prisma and introspection
- 6279235f: Update build process to use swc and move type definitions to dts directory

### Patch Changes

- 21a2454e: update dev dependencies

## 0.3.0

### Minor Changes

- 9b6353d4: Add support for context and info in resolveReference

## 0.2.5

### Patch Changes

- ad8d119b: update dev dependencies

## 0.2.4

### Patch Changes

- 03aecf76: update .npmignore

## 0.2.3

### Patch Changes

- 43ca3031: Update dev dependencies

## 0.2.2

### Patch Changes

- 2d9b21cd: Use workspace:\* for dev dependencies on pothos packages

## 0.2.1

### Patch Changes

- 84d339e0: Update readme

## 0.2.0

### Minor Changes

- 4094e70a: Add initial support for new federation plugin
