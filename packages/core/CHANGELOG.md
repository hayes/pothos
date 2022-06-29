# Change Log

## 3.12.1

### Patch Changes

- 7311904e: Fix nullability option when using t.expose with a list type

## 3.12.0

### Minor Changes

- 32cb5073: Fix resolveType not being correctly applied for interfaces when isTypeOf is not used

## 3.11.1

### Patch Changes

- 4e5756ca: Update dev dependencies

## 3.11.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.10.1

### Patch Changes

- 89f09498: Fix issue with argument mapping utils that caused nested lists of input objects to be
  transformed incorrectly in the relay plugin

## 3.10.0

### Minor Changes

- 205a8c73: Add support for lazyloaded interfaces and ref checks for interfaces

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

## 3.6.0

### Minor Changes

- a8e31a70: Improve user experience when srtict mode is disabled

## 3.5.1

### Patch Changes

- 7d69b286: Fix field names that match intrinsic object properties (eg constructor)

## 3.5.0

### Minor Changes

- 6279235f: Update build process to use swc and move type definitions to dts directory

### Patch Changes

- 21a2454e: update dev dependencies

## 3.4.0

### Minor Changes

- c0bdbc1b: Fix type for InputFieldRef.kind

### Patch Changes

- cc12c8b3: Huge thank you to @kidqueb for contributing the first one-time sponsorship for pothos!

## 3.3.3

### Patch Changes

- cf4a2d14: cleanup style and comments

## 3.3.2

### Patch Changes

- 122dd782: Allow subscribe function to return a promise

## 3.3.1

### Patch Changes

- 03aecf76: update .npmignore

## 3.3.0

### Minor Changes

- 80b24ec1: Add ability to branded objects loaded by relay plugin with typename to reduce need to
  isTypeOf checks

## 3.2.0

### Minor Changes

- 4ad5f4ff: Normalize resolveType and isTypeOf behavior to match graphql spec behavior and allow
  both to be optional

### Patch Changes

- 43ca3031: Update dev dependencies

## 3.1.2

### Patch Changes

- 2d9b21cd: Use workspace:\* for dev dependencies on pothos packages

## 3.1.1

### Patch Changes

- 12ac37c7: Update readme links

## 3.1.0

### Minor Changes

- 4094e70a: Add initial support for new federation plugin

## 3.0.1

### Patch Changes

- a01abb7f: Fix compatability between prisma and auth plugins

## 3.0.0

### Major Changes

- 4caad5e4: Rename GiraphQL to Pothos

## 2.23.0

### Minor Changes

- afa16607: Fixed types for serialize in scalarType options

## 2.22.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 2.21.0

### Minor Changes

- 37841f1b: Revert fix for inputRef unions because of regressions

## 2.20.0

### Minor Changes

- 5b3cd026: Merge ts unions passed to inputRef and correctly use merged normalized type for
  implemented input ref

## 2.19.1

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

## 2.19.0

### Minor Changes

- 6d6d54e: Add complexity plugin

## 2.18.2

### Patch Changes

- 5619aca: Standardize context caches across all plugins to correctly take advantage of
  `initContextCache`

## 2.18.1

### Patch Changes

- c85dc33: Add types entry in package.json

## 2.18.0

### Minor Changes

- aeef5e5: Update dependencies

## 2.17.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

## 2.16.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 2.15.3

### Patch Changes

- 045e4ec: Fix a bug in argMapper that caused mappings to be omitted if the only mappings were for
  fields for input types without nested mappings

## 2.15.2

### Patch Changes

- c976bfe: Update dependencies

## 2.15.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 2.15.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 2.14.2

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

## 2.14.1

### Patch Changes

- f04be64: Update dependencies

## 2.14.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

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

- add relay integration for prisma plugin
  ([e714e54](https://github.com/hayes/giraphql/commit/e714e54))

**Note:** Version bump only for package @giraphql/core

## 2.12.0-alpha.0 - 2021-08-02

#### 🚀 Updates

- add relay integration for prisma plugin
  ([0b1d378](https://github.com/hayes/giraphql/commit/0b1d378))

**Note:** Version bump only for package @giraphql/core

## 2.11.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/core

### 2.10.2 - 2021-07-23

**Note:** Version bump only for package @giraphql/core

### 2.10.2-alpha.0 - 2021-07-17

#### 🐞 Fixes

- don't use index file import for global types in core
  ([9ee13a9](https://github.com/hayes/giraphql/commit/9ee13a9))

**Note:** Version bump only for package @giraphql/core

### 2.10.1 - 2021-07-10

#### 🐞 Fixes

- re-export from index file rather than folder to fix auto-discovery issue
  ([b1ba588](https://github.com/hayes/giraphql/commit/b1ba588))

**Note:** Version bump only for package @giraphql/core

### 2.10.0 - 2021-07-04

#### 🐞 Fixes

- format error message for better readability
  ([94f58d4](https://github.com/hayes/giraphql/commit/94f58d4))

**Note:** Version bump only for package @giraphql/core

## 2.10.0-alpha.0 - 2021-07-04

#### 🚀 Updates

- add early warning for undefined refs to simplify debugging of circular import issues
  ([095b68b](https://github.com/hayes/giraphql/commit/095b68b))

#### 📦 Dependencies

- regenerate lock file ([4d75fb4](https://github.com/hayes/giraphql/commit/4d75fb4))
- upgrade typescript ([675f6a2](https://github.com/hayes/giraphql/commit/675f6a2))

**Note:** Version bump only for package @giraphql/core

### 2.9.1 - 2021-07-02

#### 🐞 Fixes

- only create error types once ([60fddd8](https://github.com/hayes/giraphql/commit/60fddd8))

**Note:** Version bump only for package @giraphql/core

### 2.9.0 - 2021-06-28

**Note:** Version bump only for package @giraphql/core

## 2.9.0-alpha.1 - 2021-06-28

#### 🚀 Updates

- make error options optional only when options can be empty objects
  ([6791bcb](https://github.com/hayes/giraphql/commit/6791bcb))

**Note:** Version bump only for package @giraphql/core

## 2.9.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

#### 📘 Docs

- add jsdocs for plugins and fieldUtils
  ([bfe383b](https://github.com/hayes/giraphql/commit/bfe383b))

**Note:** Version bump only for package @giraphql/core

## 2.8.0 - 2021-06-11

#### 🚀 Updates

- make field options args optional when empty
  ([ae71648](https://github.com/hayes/giraphql/commit/ae71648))

#### 🐞 Fixes

- fix a couple type errors ([453bf7b](https://github.com/hayes/giraphql/commit/453bf7b))

#### 📦 Dependencies

- update dev deps ([813d9d0](https://github.com/hayes/giraphql/commit/813d9d0))

#### 📘 Docs

- add some js docs for field options ([656aa2d](https://github.com/hayes/giraphql/commit/656aa2d))

#### 🛠 Internals

- fix a couple tests ([36e6146](https://github.com/hayes/giraphql/commit/36e6146))

**Note:** Version bump only for package @giraphql/core

### 2.7.0 - 2021-06-10

#### 📘 Docs

- add example of field helpers for adding common fields to types
  ([1b0d6f8](https://github.com/hayes/giraphql/commit/1b0d6f8))

**Note:** Version bump only for package @giraphql/core

## 2.7.0-alpha.0 - 2021-06-09

#### 🚀 Updates

- plum parentShape through all ussage of output refs
  ([2dac2ca](https://github.com/hayes/giraphql/commit/2dac2ca))

**Note:** Version bump only for package @giraphql/core

## 2.6.0 - 2021-05-18

#### 🚀 Updates

- imporved support for circular imports in schema definitions
  ([72ddf0a](https://github.com/hayes/giraphql/commit/72ddf0a))

**Note:** Version bump only for package @giraphql/core

### 2.5.1 - 2021-05-12

**Note:** Version bump only for package @giraphql/core

## 2.5.0 - 2021-05-12

#### 🚀 Updates

- allow plugins to remove fields ([9370ce1](https://github.com/hayes/giraphql/commit/9370ce1))
- update deno ([7d11693](https://github.com/hayes/giraphql/commit/7d11693))

#### 🛠 Internals

- add docs and tests for removing fields
  ([a3aa90e](https://github.com/hayes/giraphql/commit/a3aa90e))

**Note:** Version bump only for package @giraphql/core

### 2.4.2 - 2021-05-10

#### 🐞 Fixes

- update ci build command ([7e1d1d2](https://github.com/hayes/giraphql/commit/7e1d1d2))

**Note:** Version bump only for package @giraphql/core

### 2.4.1 - 2021-05-10

#### 🐞 Fixes

- build esm during release script ([172d4a2](https://github.com/hayes/giraphql/commit/172d4a2))

**Note:** Version bump only for package @giraphql/core

## 2.4.0 - 2021-05-10

#### 🚀 Updates

- add esm build for all packages ([d8bbdc9](https://github.com/hayes/giraphql/commit/d8bbdc9))

#### 📘 Docs

- fix a typo ([0f2bdbb](https://github.com/hayes/giraphql/commit/0f2bdbb))
- fix links in readme ([a950d39](https://github.com/hayes/giraphql/commit/a950d39))
- fix links in readme ([6132d42](https://github.com/hayes/giraphql/commit/6132d42))
- move website link higher in readme ([2260e33](https://github.com/hayes/giraphql/commit/2260e33))

**Note:** Version bump only for package @giraphql/core

### 2.3.0 - 2021-05-09

#### 📘 Docs

- update readmes ([07c727b](https://github.com/hayes/giraphql/commit/07c727b))

**Note:** Version bump only for package @giraphql/core

## 2.3.0-alpha.0 - 2021-05-08

#### 🚀 Updates

- add new context-cache util for safer context based caching
  ([c1656cf](https://github.com/hayes/giraphql/commit/c1656cf))
- add new ParentShape helper to enable refs with different resolve and parent types
  ([18d8b1c](https://github.com/hayes/giraphql/commit/18d8b1c))
- improve resolver types with better errors and async-generator support
  ([3e39492](https://github.com/hayes/giraphql/commit/3e39492))

**Note:** Version bump only for package @giraphql/core

### 2.2.1 - 2021-05-05

#### 🐞 Fixes

- add deno files after deno-build ([3f4f94b](https://github.com/hayes/giraphql/commit/3f4f94b))

**Note:** Version bump only for package @giraphql/core

### 2.2.0 - 2021-05-05

**Note:** Version bump only for package @giraphql/core

## 2.2.0-alpha.0 - 2021-05-05

#### 🚀 Updates

- add script for generating deno compatible files
  ([6dc68c1](https://github.com/hayes/giraphql/commit/6dc68c1))

**Note:** Version bump only for package @giraphql/core

### 2.1.2 - 2021-05-02

#### 🛠 Internals

- force version bumps and update validation to 2.0 range
  ([07730b3](https://github.com/hayes/giraphql/commit/07730b3))

**Note:** Version bump only for package @giraphql/core

### 2.1.1 - 2021-05-02

#### 🛠 Internals

- migrate to @beemo/dev for dev tool configs
  ([1da1283](https://github.com/hayes/giraphql/commit/1da1283))

**Note:** Version bump only for package @giraphql/core

### 2.1.0 - 2021-04-16

**Note:** Version bump only for package @giraphql/core

## 2.1.0-alpha.0 - 2021-04-12

#### 🚀 Updates

- add giraphqlConfig to all extensions and add getInputTypeFieldConfigs method to build cache
  ([7d9c47f](https://github.com/hayes/giraphql/commit/7d9c47f))
- add new utils for mapping inputs fields in plugins
  ([be9fd1d](https://github.com/hayes/giraphql/commit/be9fd1d))
- add zod plugin ([5a77982](https://github.com/hayes/giraphql/commit/5a77982))
- build graphql types in specific order to make certain plugin use cases easier
  ([65b8942](https://github.com/hayes/giraphql/commit/65b8942))
- schemas are now sorted after being built
  ([154b51c](https://github.com/hayes/giraphql/commit/154b51c))

#### 🐞 Fixes

- args builder now coppies prototype methods from field builder so that extending FieldBuilder class
  works as expected ([bc8fd04](https://github.com/hayes/giraphql/commit/bc8fd04))
- correctly add extensions from giraphql options to build config objects for input fields
  ([33e59bc](https://github.com/hayes/giraphql/commit/33e59bc))

#### 📦 Dependencies

- update dev dependencies ([25a15d4](https://github.com/hayes/giraphql/commit/25a15d4))
- update dev deps ([cbfa0a4](https://github.com/hayes/giraphql/commit/cbfa0a4))

#### 📘 Docs

- add docs on mapping inputs ([eed4785](https://github.com/hayes/giraphql/commit/eed4785))

**Note:** Version bump only for package @giraphql/core

### 2.0.2 - 2021-03-16

**Note:** Version bump only for package @giraphql/core

### 2.0.1 - 2021-02-19

#### 🐞 Fixes

- correctly set deprecationReason ([cdc0c76](https://github.com/hayes/giraphql/commit/cdc0c76))

**Note:** Version bump only for package @giraphql/core

# 2.0.0 - 2021-02-16

#### 💥 Breaking

- update plugin API to avoid modifying args. subGraphs are now build by passing subGraph to toSchema
  ([66d456e](https://github.com/hayes/giraphql/commit/66d456e))
- update plugin exports and names to be more consistent
  ([ee07b35](https://github.com/hayes/giraphql/commit/ee07b35))

#### 🐞 Fixes

- use fieldOptionsByKind pattern for input field builder
  ([6ccf739](https://github.com/hayes/giraphql/commit/6ccf739))

#### 📦 Dependencies

- update dependencies and add license files
  ([cb0d102](https://github.com/hayes/giraphql/commit/cb0d102))

#### 📘 Docs

- add 2.0 migration guide ([48314c5](https://github.com/hayes/giraphql/commit/48314c5))
- add more docs o writing plugins ([b996fc6](https://github.com/hayes/giraphql/commit/b996fc6))
- wip - plugin guide ([cf9c6ec](https://github.com/hayes/giraphql/commit/cf9c6ec))

**Note:** Version bump only for package @giraphql/core

# 2.0.0-alpha.0 - 2021-02-10

#### 💥 Breaking

- remove field wrapper plugin api ([5d7af54](https://github.com/hayes/giraphql/commit/5d7af54))
- updated plugin API to initialize new plugins when calling toSchema
  ([05890db](https://github.com/hayes/giraphql/commit/05890db))
- you can no-longer define args on 'exposed' fields
  ([240162b](https://github.com/hayes/giraphql/commit/240162b))

#### 🚀 Updates

- add directives plugin ([b44ccde](https://github.com/hayes/giraphql/commit/b44ccde))

#### 🐞 Fixes

- add useGraphQLToolsUnorderedDirectives option to directive plugin
  ([a9e1ca6](https://github.com/hayes/giraphql/commit/a9e1ca6))

#### 📘 Docs

- add initial docs for scope auth plugin
  ([15b086d](https://github.com/hayes/giraphql/commit/15b086d))

#### 🛠 Internals

- add some basic scope-auth tests ([7ceb24a](https://github.com/hayes/giraphql/commit/7ceb24a))

**Note:** Version bump only for package @giraphql/core

### 1.6.0-alpha.1 - 2021-02-01

#### 🐞 Fixes

- add useGraphQLToolsUnorderedDirectives option to directive plugin
  ([6517dd4](https://github.com/hayes/giraphql/commit/6517dd4))

**Note:** Version bump only for package @giraphql/core

## 1.6.0-alpha.0 - 2021-02-01

#### 🚀 Updates

- add directives plugin ([ff76fe7](https://github.com/hayes/giraphql/commit/ff76fe7))

**Note:** Version bump only for package @giraphql/core

### 1.5.1 - 2021-01-26

#### 🐞 Fixes

- use thenable instead of types.isPromise to support custom promise implementations
  ([f5625e4](https://github.com/hayes/giraphql/commit/f5625e4))

**Note:** Version bump only for package @giraphql/core

### 1.5.0 - 2021-01-23

**Note:** Version bump only for package @giraphql/core

## 1.5.0-alpha.0 - 2021-01-23

#### 🚀 Updates

- improve error messages for unresolved refs and allow arguments to be implemented after references
  ([8c5a8b0](https://github.com/hayes/giraphql/commit/8c5a8b0))

**Note:** Version bump only for package @giraphql/core

### 1.4.0 - 2021-01-11

**Note:** Version bump only for package @giraphql/core

## 1.4.0-alpha.1 - 2021-01-10

#### 🚀 Updates

- only enable wrapping when a plugin with field wrapper is enabled
  ([1c24fcd](https://github.com/hayes/giraphql/commit/1c24fcd))
- remove extra async awaits in auth plugin
  ([fe9273d](https://github.com/hayes/giraphql/commit/fe9273d))
- significantly reduce number of awaits in resolve wrappers
  ([3dd028d](https://github.com/hayes/giraphql/commit/3dd028d))

**Note:** Version bump only for package @giraphql/core

# [1.1.0](https://github.com/hayes/giraphql/compare/@giraphql/core@1.1.0-alpha.0...@giraphql/core@1.1.0) (2020-10-21)

**Note:** Version bump only for package @giraphql/core

# Changelog

### 1.0.0

Initial release
