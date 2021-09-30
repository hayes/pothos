# Change Log

## 2.10.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 2.9.0

### Minor Changes

- 73e947b: Add directResult option to remove extra result type wrapper in error unions

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

- ea4d456: Add interoperability between prisma and errors plugins

## 2.6.0

### Minor Changes

- 4f9b886: Add integration between error and dataloader plugins to that errors from dataloaders can
  be handled via errors plugin

## 2.5.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

## 2.4.2

### Patch Changes

- f13208c: bump to fix latest tag

## 2.4.1

### Patch Changes

- 9ab8fbc: re-release previous version due to build-process issue

## 2.4.0

### Minor Changes

- 3dd3ff14: Updated dev dependencies, switched to pnpm, and added changesets for releases

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 2.3.1 - 2021-08-03

**Note:** Version bump only for package @giraphql/plugin-errors

### 2.3.1-alpha.0 - 2021-08-02

**Note:** Version bump only for package @giraphql/plugin-errors

## 2.3.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/plugin-errors

### 2.2.2 - 2021-07-23

**Note:** Version bump only for package @giraphql/plugin-errors

### 2.2.2-alpha.0 - 2021-07-17

**Note:** Version bump only for package @giraphql/plugin-errors

### 2.2.1 - 2021-07-10

**Note:** Version bump only for package @giraphql/plugin-errors

### 2.2.0 - 2021-07-04

**Note:** Version bump only for package @giraphql/plugin-errors

## 2.2.0-alpha.0 - 2021-07-04

#### 🚀 Updates

- add early warning for undefined refs to simplify debugging of circular import issues
  ([095b68b](https://github.com/hayes/giraphql/commit/095b68b))

#### 📦 Dependencies

- upgrade typescript ([675f6a2](https://github.com/hayes/giraphql/commit/675f6a2))

**Note:** Version bump only for package @giraphql/plugin-errors

### 2.1.2 - 2021-07-02

#### 🐞 Fixes

- only create error types once ([60fddd8](https://github.com/hayes/giraphql/commit/60fddd8))

#### 📘 Docs

- add es6 target requirement to error plugin docs
  ([a218973](https://github.com/hayes/giraphql/commit/a218973))

**Note:** Version bump only for package @giraphql/plugin-errors

### 2.1.1 - 2021-06-30

#### 📘 Docs

- update docs to include links to error plugin
  ([46db92d](https://github.com/hayes/giraphql/commit/46db92d))

**Note:** Version bump only for package @giraphql/plugin-errors

### 2.1.0 - 2021-06-28

#### 🐞 Fixes

- type default empty objects as never to ensure compatibility with plugins that add required options
  ([e457c02](https://github.com/hayes/giraphql/commit/e457c02))

**Note:** Version bump only for package @giraphql/plugin-errors

## 2.1.0-alpha.1 - 2021-06-28

#### 🚀 Updates

- make error options optional only when options can be empty objects
  ([6791bcb](https://github.com/hayes/giraphql/commit/6791bcb))
- update docs and deno ([4f131b0](https://github.com/hayes/giraphql/commit/4f131b0))

#### 🐞 Fixes

- fix typos in tests and docs ([3b81ba2](https://github.com/hayes/giraphql/commit/3b81ba2))

**Note:** Version bump only for package @giraphql/plugin-errors

## 2.1.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

**Note:** Version bump only for package @giraphql/plugin-errors
