# Change Log

## 2.9.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 2.8.2

### Patch Changes

- c976bfe: Update dependencies

## 2.8.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 2.8.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 2.7.1

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

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

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.5.1-alpha.0 - 2021-08-02

**Note:** Version bump only for package @giraphql/plugin-simple-objects

## 2.5.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.4.4 - 2021-07-23

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.4.4-alpha.0 - 2021-07-17

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.4.3 - 2021-07-10

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.4.2 - 2021-07-04

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.4.2-alpha.0 - 2021-07-04

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.4.1 - 2021-07-02

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.4.0 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.4.0-alpha.1 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-simple-objects

## 2.4.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

## 2.3.0 - 2021-06-11

#### 🚀 Updates

- make field options args optional when empty
  ([ae71648](https://github.com/hayes/giraphql/commit/ae71648))

#### 📦 Dependencies

- update dev deps ([813d9d0](https://github.com/hayes/giraphql/commit/813d9d0))

#### 🛠 Internals

- fix a couple tests ([36e6146](https://github.com/hayes/giraphql/commit/36e6146))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.2.0 - 2021-06-10

**Note:** Version bump only for package @giraphql/plugin-simple-objects

## 2.2.0-alpha.0 - 2021-06-09

#### 🚀 Updates

- plum parentShape through all ussage of output refs
  ([2dac2ca](https://github.com/hayes/giraphql/commit/2dac2ca))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.1.5 - 2021-05-18

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.1.4 - 2021-05-13

#### 📘 Docs

- add docs for loadableNode ([1ae01e8](https://github.com/hayes/giraphql/commit/1ae01e8))

#### 🛠 Internals

- add tests for loadableNode ([c1b49a0](https://github.com/hayes/giraphql/commit/c1b49a0))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.1.3 - 2021-05-12

#### 🛠 Internals

- udate dev deps ([3251227](https://github.com/hayes/giraphql/commit/3251227))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.1.2 - 2021-05-10

#### 🐞 Fixes

- update ci build command ([7e1d1d2](https://github.com/hayes/giraphql/commit/7e1d1d2))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.1.1 - 2021-05-10

#### 🐞 Fixes

- force new version to fix esm build issue
  ([25f1fd2](https://github.com/hayes/giraphql/commit/25f1fd2))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

## 2.1.0 - 2021-05-10

#### 🚀 Updates

- add esm build for all packages ([d8bbdc9](https://github.com/hayes/giraphql/commit/d8bbdc9))

#### 📘 Docs

- update readmes ([07c727b](https://github.com/hayes/giraphql/commit/07c727b))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.0.3 - 2021-05-02

#### 🛠 Internals

- force version bumps and update validation to 2.0 range
  ([07730b3](https://github.com/hayes/giraphql/commit/07730b3))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.0.2 - 2021-04-16

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.0.2-alpha.0 - 2021-04-12

#### 📦 Dependencies

- update dev dependencies ([25a15d4](https://github.com/hayes/giraphql/commit/25a15d4))
- update dev deps ([cbfa0a4](https://github.com/hayes/giraphql/commit/cbfa0a4))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.0.1 - 2021-02-19

**Note:** Version bump only for package @giraphql/plugin-simple-objects

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

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 2.0.0-alpha.1 - 2021-02-10

#### 🛠 Internals

- bump simple-objects to 2.0 ([2ee091a](https://github.com/hayes/giraphql/commit/2ee091a))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 1.2.2-alpha.0 - 2021-02-10

#### 🛠 Internals

- fix broken dev deps ([7af8a0a](https://github.com/hayes/giraphql/commit/7af8a0a))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

### 1.2.1 - 2021-02-07

#### 🐞 Fixes

- specify @giraphql/core as peer and dev dep so it is updated correctly
  ([f096393](https://github.com/hayes/giraphql/commit/f096393))

**Note:** Version bump only for package @giraphql/plugin-simple-objects

# [1.1.0](https://github.com/hayes/giraphql/compare/@giraphql/plugin-simple-objects@1.1.0-alpha.0...@giraphql/plugin-simple-objects@1.1.0) (2020-10-21)

**Note:** Version bump only for package @giraphql/plugin-simple-objects

# Changelog

### 1.0.0

Initial release
