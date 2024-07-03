# Change Log

## 4.0.0-next.0

### Major Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

## 3.5.10

### Patch Changes

- 1ecea46: revert accidental pinning of graphql peer dependency

## 3.5.9

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.5.8

### Patch Changes

- d4d41796: Update dev dependencies

## 3.5.7

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 3.5.6

### Patch Changes

- b12f9122: Fix issue with esm build script

## 3.5.5

### Patch Changes

- d350f842: update dev deps

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

## 3.4.1

### Patch Changes

- aa18acb7: update dev dependencies

## 3.4.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 3.3.5

### Patch Changes

- e297e78a: Support typescript@4.8

## 3.3.4

### Patch Changes

- 3ead60ae: update dev deps

## 3.3.3

### Patch Changes

- c8f75aa1: Update dev dependencies

## 3.3.2

### Patch Changes

- 4e5756ca: Update dev dependencies

## 3.3.1

### Patch Changes

- 4b24982f: Update dev dependencies

## 3.3.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.2.2

### Patch Changes

- 205a8c73: Recactor internal imports to reduce imports from index files

## 3.2.1

### Patch Changes

- 971f1aad: Update dev dependencies

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

## 2.12.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 2.11.1

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

## 2.11.0

### Minor Changes

- 6d2a6d9: Update to support typescript 4.5. typescript@>4.5.2 is now required for code generation
  in the prisma plugin

## 2.10.1

### Patch Changes

- c85dc33: Add types entry in package.json

## 2.10.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

## 2.9.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 2.8.3

### Patch Changes

- 045e4ec: Fix a bug in argMapper that caused mappings to be omitted if the only mappings were for
  fields for input types without nested mappings

## 2.8.2

### Patch Changes

- c976bfe: Update dependencies

## 2.8.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 2.8.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 2.7.2

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

## 2.7.1

### Patch Changes

- f04be64: Update dependencies

## 2.7.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

## 2.6.2

### Patch Changes

- f13208c: bump to fix latest tag

## 2.6.1

### Patch Changes

- 9ab8fbc: re-release previous version due to build-process issue

## 2.6.0

### Minor Changes

- 3dd3ff14: Updated dev dependencies, switched to pnpm, and added changesets for releases

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 2.5.1 - 2021-08-03

**Note:** Version bump only for package @giraphql/converter

### 2.5.1-alpha.0 - 2021-08-02

**Note:** Version bump only for package @giraphql/converter

## 2.5.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/converter

### 2.4.4 - 2021-07-23

**Note:** Version bump only for package @giraphql/converter

### 2.4.4-alpha.0 - 2021-07-17

**Note:** Version bump only for package @giraphql/converter

### 2.4.3 - 2021-07-10

**Note:** Version bump only for package @giraphql/converter

### 2.4.2 - 2021-07-04

**Note:** Version bump only for package @giraphql/converter

### 2.4.2-alpha.0 - 2021-07-04

#### 📦 Dependencies

- upgrade typescript ([675f6a2](https://github.com/hayes/giraphql/commit/675f6a2))

**Note:** Version bump only for package @giraphql/converter

### 2.4.1 - 2021-07-02

**Note:** Version bump only for package @giraphql/converter

### 2.4.0 - 2021-06-28

**Note:** Version bump only for package @giraphql/converter

### 2.4.0-alpha.1 - 2021-06-28

**Note:** Version bump only for package @giraphql/converter

## 2.4.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

**Note:** Version bump only for package @giraphql/converter

## 2.3.0 - 2021-06-11

#### 🚀 Updates

- make field options args optional when empty
  ([ae71648](https://github.com/hayes/giraphql/commit/ae71648))

#### 📦 Dependencies

- update dev deps ([813d9d0](https://github.com/hayes/giraphql/commit/813d9d0))

#### 🛠 Internals

- fix a couple tests ([36e6146](https://github.com/hayes/giraphql/commit/36e6146))

**Note:** Version bump only for package @giraphql/converter

### 2.2.7 - 2021-06-10

**Note:** Version bump only for package @giraphql/converter

### 2.2.7-alpha.0 - 2021-06-09

**Note:** Version bump only for package @giraphql/converter

### 2.2.6 - 2021-05-18

**Note:** Version bump only for package @giraphql/converter

### 2.2.5 - 2021-05-13

#### 📘 Docs

- add docs for loadableNode ([1ae01e8](https://github.com/hayes/giraphql/commit/1ae01e8))

#### 🛠 Internals

- add tests for loadableNode ([c1b49a0](https://github.com/hayes/giraphql/commit/c1b49a0))

**Note:** Version bump only for package @giraphql/converter

### 2.2.4 - 2021-05-12

#### 🐞 Fixes

- copy examples for converter tests ([b19fd40](https://github.com/hayes/giraphql/commit/b19fd40))
- update converted tests to work with esm
  ([7cb9588](https://github.com/hayes/giraphql/commit/7cb9588))

#### 🛠 Internals

- udate dev deps ([3251227](https://github.com/hayes/giraphql/commit/3251227))

**Note:** Version bump only for package @giraphql/converter

### 2.2.3 - 2021-05-10

#### 🐞 Fixes

- update ci build command ([7e1d1d2](https://github.com/hayes/giraphql/commit/7e1d1d2))

**Note:** Version bump only for package @giraphql/converter

### 2.2.2 - 2021-05-10

#### 🐞 Fixes

- build esm during release script ([172d4a2](https://github.com/hayes/giraphql/commit/172d4a2))

**Note:** Version bump only for package @giraphql/converter

### 2.2.1 - 2021-05-10

**Note:** Version bump only for package @giraphql/converter

### 2.2.0 - 2021-05-09

**Note:** Version bump only for package @giraphql/converter

## 2.2.0-alpha.0 - 2021-05-08

#### 🚀 Updates

- improve resolver types with better errors and async-generator support
  ([3e39492](https://github.com/hayes/giraphql/commit/3e39492))

**Note:** Version bump only for package @giraphql/converter

### 2.1.4 - 2021-05-05

**Note:** Version bump only for package @giraphql/converter

### 2.1.3 - 2021-05-05

**Note:** Version bump only for package @giraphql/converter

### 2.1.3-alpha.0 - 2021-05-05

**Note:** Version bump only for package @giraphql/converter

### 2.1.2 - 2021-05-02

**Note:** Version bump only for package @giraphql/converter

### 2.1.1 - 2021-05-02

#### 🛠 Internals

- migrate to @beemo/dev for dev tool configs
  ([1da1283](https://github.com/hayes/giraphql/commit/1da1283))

**Note:** Version bump only for package @giraphql/converter

### 2.1.0 - 2021-04-16

**Note:** Version bump only for package @giraphql/converter

## 2.1.0-alpha.0 - 2021-04-12

#### 🚀 Updates

- schemas are now sorted after being built
  ([154b51c](https://github.com/hayes/giraphql/commit/154b51c))

#### 📦 Dependencies

- update dev dependencies ([25a15d4](https://github.com/hayes/giraphql/commit/25a15d4))
- update dev deps ([cbfa0a4](https://github.com/hayes/giraphql/commit/cbfa0a4))

**Note:** Version bump only for package @giraphql/converter

### 2.0.2 - 2021-03-16

**Note:** Version bump only for package @giraphql/converter

### 2.0.1 - 2021-02-19

**Note:** Version bump only for package @giraphql/converter

# 2.0.0 - 2021-02-16

#### 💥 Breaking

- update plugin exports and names to be more consistent
  ([ee07b35](https://github.com/hayes/giraphql/commit/ee07b35))

#### 📦 Dependencies

- update dependencies and add license files
  ([cb0d102](https://github.com/hayes/giraphql/commit/cb0d102))

**Note:** Version bump only for package @giraphql/converter

### 2.0.0-alpha.0 - 2021-02-10

#### 🛠 Internals

- bump converter to 2.0 ([bf0964d](https://github.com/hayes/giraphql/commit/bf0964d))

**Note:** Version bump only for package @giraphql/converter

### 1.4.3-alpha.2 - 2021-02-10

**Note:** Version bump only for package @giraphql/converter

### 1.4.3-alpha.1 - 2021-02-01

**Note:** Version bump only for package @giraphql/converter

### 1.4.3-alpha.0 - 2021-02-01

**Note:** Version bump only for package @giraphql/converter

### 1.4.2 - 2021-01-26

**Note:** Version bump only for package @giraphql/converter

### 1.4.1 - 2021-01-23

**Note:** Version bump only for package @giraphql/converter

### 1.4.1-alpha.0 - 2021-01-23

**Note:** Version bump only for package @giraphql/converter

### 1.4.0 - 2021-01-11

**Note:** Version bump only for package @giraphql/converter

### 1.4.0-alpha.1 - 2021-01-10

**Note:** Version bump only for package @giraphql/converter

# [1.1.0](https://github.com/hayes/giraphql/compare/@giraphql/converter@1.1.0-alpha.0...@giraphql/converter@1.1.0) (2020-10-21)

**Note:** Version bump only for package @giraphql/converter

# Changelog

### 1.0.0

Initial release
