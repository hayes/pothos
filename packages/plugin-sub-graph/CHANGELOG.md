# Change Log

## 4.3.2

### Patch Changes

- 1622740: update dependencies

## 4.3.1

### Patch Changes

- cd7f309: Update dependencies

## 4.3.0

### Minor Changes

- 456da16: Add support for custom names on Root types

## 4.2.0

### Minor Changes

- de28b57: Add explicitlyIncludeType option to subGraph options

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

## 3.13.3

### Patch Changes

- 1ecea46: revert accidental pinning of graphql peer dependency

## 3.13.2

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.13.1

### Patch Changes

- 324027f8: Fix deprecation reasons missing for inputs and args in sub-graphs

## 3.13.0

### Minor Changes

- bf0385ae: Add new PothosError classes

## 3.12.7

### Patch Changes

- d4d41796: Update dev dependencies

## 3.12.6

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 3.12.5

### Patch Changes

- b12f9122: Fix issue with esm build script

## 3.12.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 3.12.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 3.12.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 3.12.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 3.12.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 3.11.1

### Patch Changes

- aa18acb7: update dev dependencies

## 3.11.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 3.10.0

### Minor Changes

- 95fcbaf8: Stop omitting types that implement a returned interface when they should be part of the
  sub-graph

## 3.9.0

### Minor Changes

- 1ff66576: filter interfaces when building subgraph

## 3.8.0

### Minor Changes

- b04a14a3: Support filtering optional arguments and input fields

## 3.7.0

### Minor Changes

- 1769afd1: Fix compatibility with Errors and Relay plugins

## 3.6.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 3.5.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.4.0

### Minor Changes

- a8e31a70: Improve user experience when srtict mode is disabled

## 3.3.0

### Minor Changes

- 241a385f: Add peer dependency on @pothos/core

## 3.2.0

### Minor Changes

- 6279235f: Update build process to use swc and move type definitions to dts directory

### Patch Changes

- 21a2454e: update dev dependencies

## 3.1.1

### Patch Changes

- 03aecf76: update .npmignore

## 3.1.0

### Minor Changes

- 4ad5f4ff: Normalize resolveType and isTypeOf behavior to match graphql spec behavior and allow
  both to be optional

### Patch Changes

- 43ca3031: Update dev dependencies

## 3.0.1

### Patch Changes

- 2d9b21cd: Use workspace:\* for dev dependencies on pothos packages

## 3.0.0

### Major Changes

- 4caad5e4: Rename GiraphQL to Pothos

## 2.11.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 2.10.3

### Patch Changes

- 2b08f852: Fix syntax highlighting in docs and update npm README.md files"

## 2.10.2

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

## 2.10.1

### Patch Changes

- c85dc33: Add types entry in package.json

## 2.10.0

### Minor Changes

- aeef5e5: Update dependencies

## 2.9.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

## 2.8.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 2.7.2

### Patch Changes

- c976bfe: Update dependencies

## 2.7.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 2.7.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 2.6.1

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

## 2.6.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

## 2.5.2

### Patch Changes

- f13208c: bump to fix latest tag

## 2.5.1

### Patch Changes

- 9ab8fbc: re-release previous version due to build-process issue

## 2.5.0

### Minor Changes

- 3dd3ff14: Updated dev dependencies, switched to pnpm, and added changesets for releases

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 2.4.1 - 2021-08-03

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.4.1-alpha.0 - 2021-08-02

**Note:** Version bump only for package @giraphql/plugin-sub-graph

## 2.4.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.3.4 - 2021-07-23

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.3.4-alpha.0 - 2021-07-17

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.3.3 - 2021-07-10

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.3.2 - 2021-07-04

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.3.2-alpha.0 - 2021-07-04

#### 📦 Dependencies

- upgrade typescript ([675f6a2](https://github.com/hayes/giraphql/commit/675f6a2))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.3.1 - 2021-07-02

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.3.0 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.3.0-alpha.1 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-sub-graph

## 2.3.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.2.2 - 2021-06-11

#### 📦 Dependencies

- update dev deps ([813d9d0](https://github.com/hayes/giraphql/commit/813d9d0))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.2.1 - 2021-06-10

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.2.1-alpha.0 - 2021-06-09

**Note:** Version bump only for package @giraphql/plugin-sub-graph

## 2.2.0 - 2021-05-30

#### 🚀 Updates

- allow building schema from multiple subgraphs
  ([830ffad](https://github.com/hayes/giraphql/commit/830ffad))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.1.5 - 2021-05-18

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.1.4 - 2021-05-13

#### 📘 Docs

- add docs for loadableNode ([1ae01e8](https://github.com/hayes/giraphql/commit/1ae01e8))

#### 🛠 Internals

- add tests for loadableNode ([c1b49a0](https://github.com/hayes/giraphql/commit/c1b49a0))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.1.3 - 2021-05-12

#### 🛠 Internals

- udate dev deps ([3251227](https://github.com/hayes/giraphql/commit/3251227))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.1.2 - 2021-05-10

#### 🐞 Fixes

- update ci build command ([7e1d1d2](https://github.com/hayes/giraphql/commit/7e1d1d2))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.1.1 - 2021-05-10

#### 🐞 Fixes

- force new version to fix esm build issue
  ([25f1fd2](https://github.com/hayes/giraphql/commit/25f1fd2))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

## 2.1.0 - 2021-05-10

#### 🚀 Updates

- add esm build for all packages ([d8bbdc9](https://github.com/hayes/giraphql/commit/d8bbdc9))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.8 - 2021-05-09

#### 📘 Docs

- update readmes ([07c727b](https://github.com/hayes/giraphql/commit/07c727b))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.8-alpha.0 - 2021-05-08

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.7 - 2021-05-05

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.6 - 2021-05-05

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.6-alpha.0 - 2021-05-05

#### 🐞 Fixes

- cleanup a couple issues that made plugins not work with deno
  ([92497d1](https://github.com/hayes/giraphql/commit/92497d1))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.5 - 2021-05-02

#### 🛠 Internals

- force version bumps and update validation to 2.0 range
  ([07730b3](https://github.com/hayes/giraphql/commit/07730b3))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.4 - 2021-05-02

#### 🛠 Internals

- migrate to @beemo/dev for dev tool configs
  ([1da1283](https://github.com/hayes/giraphql/commit/1da1283))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.3 - 2021-04-16

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.3-alpha.0 - 2021-04-12

#### 📦 Dependencies

- update dev dependencies ([25a15d4](https://github.com/hayes/giraphql/commit/25a15d4))
- update dev deps ([cbfa0a4](https://github.com/hayes/giraphql/commit/cbfa0a4))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.2 - 2021-03-16

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.1 - 2021-02-19

**Note:** Version bump only for package @giraphql/plugin-sub-graph

# 2.0.0 - 2021-02-16

#### 💥 Breaking

- update plugin API to avoid modifying args. subGraphs are now build by passing subGraph to toSchema
  ([66d456e](https://github.com/hayes/giraphql/commit/66d456e))
- update plugin exports and names to be more consistent
  ([ee07b35](https://github.com/hayes/giraphql/commit/ee07b35))

#### 📦 Dependencies

- update dependencies and add license files
  ([cb0d102](https://github.com/hayes/giraphql/commit/cb0d102))

#### 📘 Docs

- add more docs o writing plugins ([b996fc6](https://github.com/hayes/giraphql/commit/b996fc6))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 2.0.0-alpha.1 - 2021-02-10

#### 🛠 Internals

- fix broken dev deps ([7af8a0a](https://github.com/hayes/giraphql/commit/7af8a0a))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

# 2.0.0-alpha.0 - 2021-02-10

#### 💥 Breaking

- bump peer deps to 2.0 range ([2a0fae8](https://github.com/hayes/giraphql/commit/2a0fae8))
- updated plugin API to initialize new plugins when calling toSchema
  ([05890db](https://github.com/hayes/giraphql/commit/05890db))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

### 1.2.1 - 2021-02-07

#### 🐞 Fixes

- specify @giraphql/core as peer and dev dep so it is updated correctly
  ([f096393](https://github.com/hayes/giraphql/commit/f096393))

**Note:** Version bump only for package @giraphql/plugin-sub-graph

# [1.1.0](https://github.com/hayes/giraphql/compare/@giraphql/plugin-sub-graph@1.1.0-alpha.1...@giraphql/plugin-sub-graph@1.1.0) (2020-10-21)

**Note:** Version bump only for package @giraphql/plugin-sub-graph

# Changelog

### 1.0.0

Initial release
