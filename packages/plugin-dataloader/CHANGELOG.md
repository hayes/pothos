# Change Log

## 2.19.0

### Minor Changes

- aeef5e5: Update dependencies

## 2.18.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

## 2.17.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 2.16.1

### Patch Changes

- c976bfe: Update dependencies

## 2.16.0

### Minor Changes

- 3f104b3: Add new sort and toKey options to allow automatic sorting of loadable objects and fields
  so load functions can return values in arbirary order

## 2.15.0

### Minor Changes

- 5562695: Add loadableInterface and loadableUnion methods

## 2.14.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 2.14.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 2.13.0

### Minor Changes

- 8c83898: Adds option to prime dataloaders with objects returned from the resolver.

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

## 2.12.0

### Minor Changes

- 4f9b886: Add integration between error and dataloader plugins to that errors from dataloaders can
  be handled via errors plugin

## 2.11.0

### Minor Changes

- f70501b: Add support for classes and object refs with dataloader objects

## 2.10.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

## 2.9.2

### Patch Changes

- f13208c: bump to fix latest tag

## 2.9.1

### Patch Changes

- 9ab8fbc: re-release previous version due to build-process issue

## 2.9.0

### Minor Changes

- 3dd3ff14: Updated dev dependencies, switched to pnpm, and added changesets for releases

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 2.8.1 - 2021-08-05

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.8.0 - 2021-08-03

#### 🚀 Updates

- update deno ([16ba12c](https://github.com/hayes/giraphql/commit/16ba12c))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.7.1-alpha.0 - 2021-08-02

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.7.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.6.0 - 2021-07-29

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.6.0-alpha.0 - 2021-07-28

#### 🚀 Updates

- expose input and object ref from relayMutationField
  ([af5a061](https://github.com/hayes/giraphql/commit/af5a061))

#### 🐞 Fixes

- improve handling of null edges in resolveConnection helpers
  ([6577a00](https://github.com/hayes/giraphql/commit/6577a00))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.6 - 2021-07-23

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.6-alpha.0 - 2021-07-17

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.5 - 2021-07-10

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.4 - 2021-07-04

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.4-alpha.1 - 2021-07-04

#### 📦 Dependencies

- upgrade typescript ([675f6a2](https://github.com/hayes/giraphql/commit/675f6a2))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.4-alpha.0 - 2021-07-03

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.3 - 2021-07-02

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.2 - 2021-07-02

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.1 - 2021-06-29

#### 🐞 Fixes

- loadableNode should correctly include additional interfaces
  ([f11f7d7](https://github.com/hayes/giraphql/commit/f11f7d7))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.0 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.5.0-alpha.1 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.5.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.4.0 - 2021-06-11

#### 🚀 Updates

- make field options args optional when empty
  ([ae71648](https://github.com/hayes/giraphql/commit/ae71648))

#### 📦 Dependencies

- update dev deps ([813d9d0](https://github.com/hayes/giraphql/commit/813d9d0))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.3.0 - 2021-06-10

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.3.0-alpha.0 - 2021-06-09

#### 🚀 Updates

- plum parentShape through all ussage of output refs
  ([2dac2ca](https://github.com/hayes/giraphql/commit/2dac2ca))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.2.4 - 2021-05-31

#### 🐞 Fixes

- support interfaces on loadableObject and loadableNode
  ([1dd672c](https://github.com/hayes/giraphql/commit/1dd672c))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.2.4-alpha.2 - 2021-05-29

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.2.4-alpha.1 - 2021-05-29

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.2.4-alpha.0 - 2021-05-29

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.2.3 - 2021-05-28

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.2.2 - 2021-05-26

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.2.1 - 2021-05-18

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.2.0 - 2021-05-13

#### 🚀 Updates

- add loadableNodes method to use relay and dataloader plugin together
  ([966c06f](https://github.com/hayes/giraphql/commit/966c06f))

#### 📘 Docs

- add docs for loadableNode ([1ae01e8](https://github.com/hayes/giraphql/commit/1ae01e8))

#### 🛠 Internals

- add tests for loadableNode ([c1b49a0](https://github.com/hayes/giraphql/commit/c1b49a0))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.1.3 - 2021-05-12

#### 🛠 Internals

- add docs and tests for removing fields
  ([a3aa90e](https://github.com/hayes/giraphql/commit/a3aa90e))
- udate dev deps ([3251227](https://github.com/hayes/giraphql/commit/3251227))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.1.2 - 2021-05-10

#### 🐞 Fixes

- update ci build command ([7e1d1d2](https://github.com/hayes/giraphql/commit/7e1d1d2))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.1.1 - 2021-05-10

#### 🐞 Fixes

- force new version to fix esm build issue
  ([25f1fd2](https://github.com/hayes/giraphql/commit/25f1fd2))

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.1.0 - 2021-05-10

#### 🚀 Updates

- add esm build for all packages ([d8bbdc9](https://github.com/hayes/giraphql/commit/d8bbdc9))

#### 📘 Docs

- add docs on adding dataloader options
  ([cdf096a](https://github.com/hayes/giraphql/commit/cdf096a))
- fix a couple issues in dataloader docs
  ([10f0a6c](https://github.com/hayes/giraphql/commit/10f0a6c))

**Note:** Version bump only for package @giraphql/plugin-dataloader

### 2.0.0 - 2021-05-09

#### 📘 Docs

- update readmes ([07c727b](https://github.com/hayes/giraphql/commit/07c727b))

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.0.0-alpha.2 - 2021-05-08

#### 🚀 Updates

- add deno support for dataloader plugin
  ([720ba01](https://github.com/hayes/giraphql/commit/720ba01))

**Note:** Version bump only for package @giraphql/plugin-dataloader

## 2.0.0-alpha.1 - 2021-05-08

#### 🚀 Updates

- add dataloader plugin ([2e2403a](https://github.com/hayes/giraphql/commit/2e2403a))
- support more dataloader flows and add tests
  ([adf9408](https://github.com/hayes/giraphql/commit/adf9408))

#### 🐞 Fixes

- rename duplicate field in example ([8c55d1f](https://github.com/hayes/giraphql/commit/8c55d1f))
- update snapshots with new test fields
  ([a7cc628](https://github.com/hayes/giraphql/commit/a7cc628))

**Note:** Version bump only for package @giraphql/plugin-dataloader
