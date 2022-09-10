# Change Log

## 3.27.0

### Minor Changes

- cf93c7c9: Fix some edge cases with how option objects become optional when no arguments are
  required

## 3.26.0

### Minor Changes

- 631dea27: Move some checks from isTypeOf to resovleType to improve performance and allow nodes
  without isTypeOf checks

## 3.25.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 3.24.2

### Patch Changes

- e297e78a: Support typescript@4.8

## 3.24.1

### Patch Changes

- 3f5d2a92: Use fieldComplexity from both builder and toSchema options

## 3.24.0

### Minor Changes

- c82d5719: add builder option for calculating complexity based on field

## 3.23.0

### Minor Changes

- 76d50bb4: Fix import of cjs graphql file in esm pothos

## 3.22.0

### Minor Changes

- c9b02338: Support context when using custom gloablID encoding or decoding

## 3.21.0

### Minor Changes

- 390e74a7: Add `idFieldOptions` to relay plugin options

## 3.20.0

### Minor Changes

- c5b1e2d3: Only use abstractReturnShapeKey when resolveType is not provided

## 3.19.0

### Minor Changes

- 33789284: Update cursor encoding to work in deno

## 3.18.0

### Minor Changes

- 2bb5db96: Added new nodesOnConnections option for adding a nodes field on connections

## 3.17.0

### Minor Changes

- 09572175: Add builder options for default union and result type options

## 3.16.1

### Patch Changes

- c102f522: Fix withAuth on prismaObject fields builders

## 3.16.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 3.15.0

### Minor Changes

- ad928594: Add defaultConnectionTypeOptions and defaultEdgeTypeOptions

### Patch Changes

- 04ed2b0c: Fix args in plugin methods on connection fields sometimes not being typed correctly

## 3.14.0

### Minor Changes

- 7311904e: Add ability to accept an inputTypeRef for builder.mutationField
- 7311904e: Add withAuth method to return a field builder to allow custom auth context with other
  plugin methods

### Patch Changes

- 7311904e: Fix nullability option when using t.expose with a list type
- 7311904e: Update dev deps

## 3.13.1

### Patch Changes

- c8f75aa1: Update dev dependencies

## 3.13.0

### Minor Changes

- 79e69c2b: Add resolveCursorConnection helper for relay plugin

## 3.12.0

### Minor Changes

- 32cb5073: Fix resolveType not being correctly applied for interfaces when isTypeOf is not used

## 3.11.1

### Patch Changes

- 4e5756ca: Update dev dependencies

## 3.11.0

### Minor Changes

- 1735eb40: Add edgeObject method to relay plugin

## 3.10.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.9.2

### Patch Changes

- 89f09498: Fix issue with argument mapping utils that caused nested lists of input objects to be
  transformed incorrectly in the relay plugin

## 3.9.1

### Patch Changes

- 205a8c73: Recactor internal imports to reduce imports from index files

## 3.9.0

### Minor Changes

- ce1063e3: Add new tracinig packages

### Patch Changes

- 040d0664: Use direct imports rather than importing from index files where possible

## 3.8.0

### Minor Changes

- f0741c42: Set typename on field configs based on usage rather than field builder constructor.

## 3.7.1

### Patch Changes

- 6e4ccc7b: Fix loadable refs when used with builder.objectType

## 3.7.0

### Minor Changes

- 9a0ae33e: Omit resolver for exposed fields with matching names to improve perfomance in
  graphql-jit

## 3.6.3

### Patch Changes

- 971f1aad: Update dev dependencies

## 3.6.2

### Patch Changes

- 8e6a4723: Fix issue with setting input requiredness in with-input plugin

## 3.6.1

### Patch Changes

- 7d69b286: Fix field names that match intrinsic object properties (eg constructor)

## 3.6.0

### Minor Changes

- 6279235f: Update build process to use swc and move type definitions to dts directory

### Patch Changes

- 21a2454e: update dev dependencies

## 3.5.0

### Minor Changes

- c0bdbc1b: update deno packages
- c0bdbc1b: Fix type for InputFieldRef.kind

## 3.4.3

### Patch Changes

- cf4a2d14: cleanup style and comments

## 3.4.2

### Patch Changes

- 31f9e8be: Fix isTypeOf check not handling \_\_typename correctly

## 3.4.1

### Patch Changes

- 03aecf76: update .npmignore

## 3.4.0

### Minor Changes

- 4ad5f4ff: Normalize resolveType and isTypeOf behavior to match graphql spec behavior and allow
  both to be optional

### Patch Changes

- 43ca3031: Update dev dependencies

## 3.3.1

### Patch Changes

- ab4a9ae4: Fix some type compatibility issues when skipLibCheck is false

## 3.3.0

### Minor Changes

- eb9c33b8: Add loadManyWithoutCache option to dataloader to avoid double caching in loadableNode

## 3.2.0

### Minor Changes

- 7593d24f: Add loadableList method to dataloader plugin for handling one-to-many relations

## 3.1.0

### Minor Changes

- 11b02e73: Fix some issues with type inference on nullable connections

## 3.0.0

### Major Changes

- 4caad5e4: Rename GiraphQL to Pothos

## 2.20.0

### Minor Changes

- afa16607: Fixed types for serialize in scalarType options

## 2.19.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 2.18.1

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

## 2.18.0

### Minor Changes

- aeef5e5: Update dependencies

## 2.17.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

## 2.16.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 2.15.4

### Patch Changes

- c976bfe: Update dependencies

## 2.15.3

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 2.15.2

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

## 2.15.1

### Patch Changes

- f04be64: Update dependencies

## 2.15.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

## 2.14.0

### Minor Changes

- 06e11f9: Pass context to query option of relation and relatedConnection fields

## 2.13.2

### Patch Changes

- f13208c: bump to fix latest tag

## 2.13.1

### Patch Changes

- 9ab8fbc: re-release previous version due to build-process issue

## 2.13.0

### Minor Changes

- 3dd3ff14: Updated dev dependencies, switched to pnpm, and added changesets for releases

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.12.0 - 2021-08-03

#### 🚀 Updates

- update deno ([16ba12c](https://github.com/hayes/giraphql/commit/16ba12c))

**Note:** Version bump only for package @giraphql/deno

## 2.11.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/deno

## 2.10.0 - 2021-07-29

#### 🚀 Updates

- update deno ([a38003b](https://github.com/hayes/giraphql/commit/a38003b))

#### 🐞 Fixes

- create start and end cursors even if edges are null
  ([64b9d2f](https://github.com/hayes/giraphql/commit/64b9d2f))

**Note:** Version bump only for package @giraphql/deno

### 2.9.1 - 2021-07-10

**Note:** Version bump only for package @giraphql/deno

### 2.9.0 - 2021-07-04

**Note:** Version bump only for package @giraphql/deno

## 2.9.0-alpha.0 - 2021-07-04

#### 🚀 Updates

- add early warning for undefined refs to simplify debugging of circular import issues
  ([095b68b](https://github.com/hayes/giraphql/commit/095b68b))

#### 📦 Dependencies

- upgrade typescript ([675f6a2](https://github.com/hayes/giraphql/commit/675f6a2))

**Note:** Version bump only for package @giraphql/deno

## 2.8.0 - 2021-07-02

#### 🚀 Updates

- update deno ([382775e](https://github.com/hayes/giraphql/commit/382775e))

**Note:** Version bump only for package @giraphql/deno

## 2.7.0 - 2021-06-30

#### 🚀 Updates

- support async refinements in validation plugin
  ([276876d](https://github.com/hayes/giraphql/commit/276876d))

**Note:** Version bump only for package @giraphql/deno

### 2.6.1 - 2021-06-29

#### 📘 Docs

- update docs to include links to error plugin
  ([46db92d](https://github.com/hayes/giraphql/commit/46db92d))

**Note:** Version bump only for package @giraphql/deno

### 2.6.0 - 2021-06-28

**Note:** Version bump only for package @giraphql/deno

## 2.6.0-alpha.1 - 2021-06-28

#### 🚀 Updates

- update docs and deno ([4f131b0](https://github.com/hayes/giraphql/commit/4f131b0))

**Note:** Version bump only for package @giraphql/deno

## 2.6.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

**Note:** Version bump only for package @giraphql/deno

## 2.5.0 - 2021-06-11

#### 🚀 Updates

- make field options args optional when empty
  ([ae71648](https://github.com/hayes/giraphql/commit/ae71648))
- update deno ([61f4b5a](https://github.com/hayes/giraphql/commit/61f4b5a))

#### 📦 Dependencies

- update dev deps ([813d9d0](https://github.com/hayes/giraphql/commit/813d9d0))

**Note:** Version bump only for package @giraphql/deno

## 2.4.0 - 2021-06-10

#### 🚀 Updates

- update deno ([d7350f9](https://github.com/hayes/giraphql/commit/d7350f9))

**Note:** Version bump only for package @giraphql/deno

## 2.3.0 - 2021-05-28

#### 🚀 Updates

- update deno ([d6365c4](https://github.com/hayes/giraphql/commit/d6365c4))

**Note:** Version bump only for package @giraphql/deno

### 2.2.1 - 2021-05-13

#### 📘 Docs

- add docs for loadableNode ([1ae01e8](https://github.com/hayes/giraphql/commit/1ae01e8))
- remove changelogs from deno dir ([952109e](https://github.com/hayes/giraphql/commit/952109e))

**Note:** Version bump only for package @giraphql/deno

## 2.2.0 - 2021-05-12

#### 🚀 Updates

- update deno ([7d11693](https://github.com/hayes/giraphql/commit/7d11693))
- update deno ([ab02c25](https://github.com/hayes/giraphql/commit/ab02c25))

**Note:** Version bump only for package @giraphql/deno

## 2.1.0 - 2021-05-10

#### 🚀 Updates

- add esm build for all packages ([d8bbdc9](https://github.com/hayes/giraphql/commit/d8bbdc9))

#### 🐞 Fixes

- fix issue with yarn run v1.22.10 ([03444ee](https://github.com/hayes/giraphql/commit/03444ee))

**Note:** Version bump only for package @giraphql/deno

### 2.0.0 - 2021-05-09

#### 🐞 Fixes

- update docs for deno ([44e1f30](https://github.com/hayes/giraphql/commit/44e1f30))

#### 📘 Docs

- sync docs changes to deno ([ce2ffc5](https://github.com/hayes/giraphql/commit/ce2ffc5))

**Note:** Version bump only for package @giraphql/deno

### 2.0.0-alpha.1 - 2021-05-08

#### 🐞 Fixes

- set deno version to 2.0 and remove auto-release
  ([cd91f6d](https://github.com/hayes/giraphql/commit/cd91f6d))

**Note:** Version bump only for package @giraphql/deno

## 0.1.0-alpha.0 - 2021-05-08

#### 🚀 Updates

- add deno support for dataloader plugin
  ([720ba01](https://github.com/hayes/giraphql/commit/720ba01))

#### 🐞 Fixes

- add deno files after deno-build ([3f4f94b](https://github.com/hayes/giraphql/commit/3f4f94b))

**Note:** Version bump only for package @giraphql/deno

### 0.0.1 - 2021-05-05

#### 📘 Docs

- use deno.land url in readme ([4db29fa](https://github.com/hayes/giraphql/commit/4db29fa))

**Note:** Version bump only for package @giraphql/deno

### 0.0.1-alpha.0 - 2021-05-05

**Note:** Version bump only for package @giraphql/deno
