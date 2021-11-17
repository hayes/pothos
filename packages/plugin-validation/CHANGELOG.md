# Change Log

## 2.14.1

### Patch Changes

- c85dc33: Add types entry in package.json

## 2.14.0

### Minor Changes

- aeef5e5: Update dependencies

## 2.13.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

## 2.12.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 2.11.0

### Minor Changes

- 2091718: Update how schemas validations are merged. This should resolve some issues with array
  intersections not being merged correctly

## 2.10.3

### Patch Changes

- 045e4ec: Fix a bug in argMapper that caused mappings to be omitted if the only mappings were for
  fields for input types without nested mappings

## 2.10.2

### Patch Changes

- c976bfe: Update dependencies

## 2.10.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 2.10.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 2.9.2

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

## 2.9.1

### Patch Changes

- f04be64: Update dependencies

## 2.9.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

## 2.8.2

### Patch Changes

- f13208c: bump to fix latest tag

## 2.8.1

### Patch Changes

- 9ab8fbc: re-release previous version due to build-process issue

## 2.8.0

### Minor Changes

- 3dd3ff14: Updated dev dependencies, switched to pnpm, and added changesets for releases

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 2.7.1 - 2021-08-03

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.7.1-alpha.0 - 2021-08-02

**Note:** Version bump only for package @giraphql/plugin-validation

## 2.7.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.6.3 - 2021-07-23

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.6.3-alpha.0 - 2021-07-17

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.6.2 - 2021-07-10

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.6.1 - 2021-07-04

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.6.1-alpha.0 - 2021-07-04

#### 📦 Dependencies

- upgrade typescript ([675f6a2](https://github.com/hayes/giraphql/commit/675f6a2))

#### 🛠 Internals

- update validation snapshots after zod upgrage
  ([29d60ba](https://github.com/hayes/giraphql/commit/29d60ba))

**Note:** Version bump only for package @giraphql/plugin-validation

## 2.6.0 - 2021-06-30

#### 🚀 Updates

- support async refinements in validation plugin
  ([276876d](https://github.com/hayes/giraphql/commit/276876d))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.5.0 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-validation

## 2.5.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

**Note:** Version bump only for package @giraphql/plugin-validation

## 2.4.0 - 2021-06-11

#### 🚀 Updates

- make field options args optional when empty
  ([ae71648](https://github.com/hayes/giraphql/commit/ae71648))

#### 📦 Dependencies

- update dev deps ([813d9d0](https://github.com/hayes/giraphql/commit/813d9d0))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.3.4 - 2021-05-13

#### 📘 Docs

- remove changelogs from deno dir ([952109e](https://github.com/hayes/giraphql/commit/952109e))

#### 🛠 Internals

- add tests for loadableNode ([c1b49a0](https://github.com/hayes/giraphql/commit/c1b49a0))
- restore yarn.lock ([324295e](https://github.com/hayes/giraphql/commit/324295e))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.3.3 - 2021-05-12

#### 🛠 Internals

- udate dev deps ([3251227](https://github.com/hayes/giraphql/commit/3251227))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.3.2 - 2021-05-10

#### 🐞 Fixes

- update ci build command ([7e1d1d2](https://github.com/hayes/giraphql/commit/7e1d1d2))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.3.1 - 2021-05-10

#### 🐞 Fixes

- force new version to fix esm build issue
  ([25f1fd2](https://github.com/hayes/giraphql/commit/25f1fd2))

**Note:** Version bump only for package @giraphql/plugin-validation

## 2.3.0 - 2021-05-10

#### 🚀 Updates

- add esm build for all packages ([d8bbdc9](https://github.com/hayes/giraphql/commit/d8bbdc9))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.2.0 - 2021-05-09

#### 📘 Docs

- update readmes ([07c727b](https://github.com/hayes/giraphql/commit/07c727b))

**Note:** Version bump only for package @giraphql/plugin-validation

## 2.2.0-alpha.0 - 2021-05-08

#### 🚀 Updates

- add dataloader plugin ([2e2403a](https://github.com/hayes/giraphql/commit/2e2403a))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.1.0 - 2021-05-05

**Note:** Version bump only for package @giraphql/plugin-validation

## 2.1.0-alpha.0 - 2021-05-05

#### 🚀 Updates

- add script for generating deno compatible files
  ([6dc68c1](https://github.com/hayes/giraphql/commit/6dc68c1))

#### 🐞 Fixes

- cleanup a couple issues that made plugins not work with deno
  ([92497d1](https://github.com/hayes/giraphql/commit/92497d1))

**Note:** Version bump only for package @giraphql/plugin-validation

### 2.0.0 - 2021-05-02

#### 🛠 Internals

- force version bumps and update validation to 2.0 range
  ([07730b3](https://github.com/hayes/giraphql/commit/07730b3))

**Note:** Version bump only for package @giraphql/plugin-validation

### 1.3.1 - 2021-05-02

#### 🛠 Internals

- migrate to @beemo/dev for dev tool configs
  ([1da1283](https://github.com/hayes/giraphql/commit/1da1283))

**Note:** Version bump only for package @giraphql/plugin-validation

## 1.3.0 - 2021-05-02

#### 🚀 Updates

- add ability to pass existing zod validators for the validation plugin
  ([55ebe2f](https://github.com/hayes/giraphql/commit/55ebe2f))

**Note:** Version bump only for package @giraphql/plugin-validation

## 1.2.0 - 2021-04-27

#### 🚀 Updates

- add createZodSchema function for manually creating zod schemas from validation options
  ([818e4f3](https://github.com/hayes/giraphql/commit/818e4f3))

**Note:** Version bump only for package @giraphql/plugin-validation

### 1.1.0 - 2021-04-16

**Note:** Version bump only for package @giraphql/plugin-validation

## 1.1.0-alpha.0 - 2021-04-12

#### 🚀 Updates

- add zod plugin ([5a77982](https://github.com/hayes/giraphql/commit/5a77982))

#### 📦 Dependencies

- update dev deps ([cbfa0a4](https://github.com/hayes/giraphql/commit/cbfa0a4))

**Note:** Version bump only for package @giraphql/plugin-validation
