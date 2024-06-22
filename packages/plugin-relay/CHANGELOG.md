# Change Log

## 3.46.1

### Patch Changes

- 1ecea46: revert accidental pinning of graphql peer dependency

## 3.46.0

### Minor Changes

- 2a1843d: Allow inputOptions on relayMutationField to be set to null to remove input argument

## 3.45.1

### Patch Changes

- 0f5cfa9: Fix bug when decoding lists of global IDs with null items

## 3.45.0

### Minor Changes

- 7d1459b: Improve typing of globalID args in node(s)QueryFieldOptions

## 3.44.0

### Minor Changes

- 96ba1822: Improve validation for global IDs

## 3.43.1

### Patch Changes

- b7954d40: Fix hasPreviousPage in resolveCursorConnection

## 3.43.0

### Minor Changes

- 0c042150: Allow globalConnectionFields to be overwritten on specific connections

## 3.42.0

### Minor Changes

- b3259d3e: Make parent and args available in connection and edge fields of prisma connections

## 3.41.1

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.41.0

### Minor Changes

- cd1558a3: Included `idFieldOptions` when creating the Node interface’s ID field.

## 3.40.0

### Minor Changes

- cd98256e: Add `nodeQueryOptions.args` and `nodesQueryOptions.args` to allow setting arg options on
  the `node` and `nodes` queries

## 3.39.0

### Minor Changes

- 1878d5d9: Allow readonly arrays in more places

## 3.38.0

### Minor Changes

- e8d75349: - allow connection fields (edges / pageInfo) to be promises
  - add completeValue helper to core for unwrapping MaybePromise values
  - set nodes as null if edges is null and the field permits a null return

## 3.37.0

### Minor Changes

- 68c94e4f: Support parsing globalIDs for loadableNode

### Patch Changes

- d2b02b79: Fix a few issues with globalID parsing

## 3.36.0

### Minor Changes

- d60cb49e: handle string contining ':' in global ID

## 3.35.0

### Minor Changes

- 1c73b585: Add new parse option for id field on nodes, and a `for` option on globalID args
- bf0385ae: Add new PothosError classes

## 3.34.0

### Minor Changes

- 252ba5fb: Add nodeField and edgesField options to edge/connection builders

## 3.33.1

### Patch Changes

- be5bff07: Update `resolveArrayConnection` return type to reflect that it always returns a non-null
  `ConnectionShape`

## 3.33.0

### Minor Changes

- 5c6e0abb: Add option for disabling node and nodes fields

## 3.32.0

### Minor Changes

- 75d13217: Export utils for formatting prisma cursors

## 3.31.0

### Minor Changes

- c3db3bcd: Enable adding interfaces to connections and edges

### Patch Changes

- fd08a9d9: allow readonly lists to be exposed and improve inference of t.expose fields

## 3.30.2

### Patch Changes

- 92ccae6d: Fix a bug where the `t.connection` helper wasn't correctly inferring the shape of the
  returned connection object when used on interfaces.

## 3.30.1

### Patch Changes

- dbc32872: Fix a bug where `builder.node` crashed when the `interfaces` was provided as a function

## 3.30.0

### Minor Changes

- daa2bf9a: Add support for custom node/nodes resolving

## 3.29.1

### Patch Changes

- 15d19a38: Fix hasNextPage when paginating backwards with resolveOffsetConnection

## 3.29.0

### Minor Changes

- cd1c0502: Add support for nested lists
- 99bc6574: Add initial support for reusable prisma connections

## 3.28.7

### Patch Changes

- d4d41796: Update dev dependencies

## 3.28.6

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 3.28.5

### Patch Changes

- b12f9122: Fix issue with esm build script

## 3.28.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 3.28.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 3.28.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 3.28.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 3.28.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 3.27.1

### Patch Changes

- aa18acb7: update dev dependencies

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

## 3.24.0

### Minor Changes

- 69be1873: Add defaultConnectionFieldOptions to relayOptions

## 3.23.0

### Minor Changes

- c9b02338: Support context when using custom gloablID encoding or decoding

## 3.22.0

### Minor Changes

- 390e74a7: Add `idFieldOptions` to relay plugin options

## 3.21.0

### Minor Changes

- 33789284: Update cursor encoding to work in deno

## 3.20.0

### Minor Changes

- 2bb5db96: Added new nodesOnConnections option for adding a nodes field on connections

## 3.19.0

### Minor Changes

- 09572175: Add options for default payload and mutation type options

## 3.18.1

### Patch Changes

- 84a77af5: Fix incorrect types for relayOptions.default(Connection|Edge)ObjectOptions

## 3.18.0

### Minor Changes

- f7f74585: Add option for configuring name of id field for relay nodes

## 3.17.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 3.16.0

### Minor Changes

- ad928594: Add defaultConnectionTypeOptions and defaultEdgeTypeOptions

### Patch Changes

- 04ed2b0c: Fix args in plugin methods on connection fields sometimes not being typed correctly

## 3.15.0

### Minor Changes

- 7311904e: Add ability to accept an inputTypeRef for builder.mutationField

### Patch Changes

- 7311904e: Update dev deps
- 7311904e: Fix nodeType option, which was incorrectly acceptiong options for an object type rather
  than an interface

## 3.14.0

### Minor Changes

- e79b3ce5: Pass node list to toCursor option of resolveCursorConnection

## 3.13.0

### Minor Changes

- 79e69c2b: Add resolveCursorConnection helper for relay plugin

## 3.12.1

### Patch Changes

- 4e5756ca: Update dev dependencies

## 3.12.0

### Minor Changes

- 1735eb40: Add edgeObject method to relay plugin

## 3.11.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.10.2

### Patch Changes

- 89f09498: Fix issue with argument mapping utils that caused nested lists of input objects to be
  transformed incorrectly in the relay plugin

## 3.10.1

### Patch Changes

- 205a8c73: Recactor internal imports to reduce imports from index files

## 3.10.0

### Minor Changes

- a8e31a70: Improve user experience when srtict mode is disabled

## 3.9.0

### Minor Changes

- 241a385f: Add peer dependency on @pothos/core

## 3.8.0

### Minor Changes

- 6279235f: Update build process to use swc and move type definitions to dts directory

### Patch Changes

- 21a2454e: update dev dependencies

## 3.7.0

### Minor Changes

- c0bdbc1b: Fix type for InputFieldRef.kind

## 3.6.0

### Minor Changes

- 8add0378: Allow relay.\*.FieldOptions objects to set `nullable` to change nullability of default
  relay fields
- 5294a17f: Explicitly make `pageInfo` non nullable. Previously `pageInfo` was nullable for
  `defaultFieldNullability: true`, which is against the Relay spec. You can revert back to previous
  behavior by updating your builder relay options:

  ```
  relay: {
    pageInfoFieldOptions: {
      nullable: true,
    },
  },
  ```

- 8add0378: Explicitly make `id` field on Node interface nullable
- 8add0378: Explicitly make `cursor` non nullable. Previously `cursor` was nullable for
  `defaultFieldNullability: true`, which is against the Relay spec. You can revert back to previous
  behavior by updating your builder relay options:

  ```
  relay: {
    cursorFieldOptions: {
      nullable: true,
    },
  },
  ```

## 3.5.2

### Patch Changes

- 31f9e8be: Fix isTypeOf check not handling \_\_typename correctly

## 3.5.1

### Patch Changes

- 03aecf76: update .npmignore

## 3.5.0

### Minor Changes

- 80b24ec1: Add ability to branded objects loaded by relay plugin with typename to reduce need to
  isTypeOf checks

### Patch Changes

- 80b24ec1: Fix issue with connection arg types

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

- 2d9b21cd: Make edge nullability configurable at both the builder and field level
- 695c9b2d: Make relay node nullability configurable

### Patch Changes

- 2d9b21cd: Use workspace:\* for dev dependencies on pothos packages

## 3.1.0

### Minor Changes

- 11b02e73: Fix some issues with type inference on nullable connections

## 3.0.0

### Major Changes

- 4caad5e4: Rename GiraphQL to Pothos

## 2.19.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 2.18.4

### Patch Changes

- 2b08f852: Fix syntax highlighting in docs and update npm README.md files"

## 2.18.3

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

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

## 2.15.2

### Patch Changes

- c976bfe: Update dependencies

## 2.15.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 2.15.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 2.14.1

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

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

### 2.12.1 - 2021-08-05

#### 🐞 Fixes

- make nodes non-nullable in resolveConnection helpers
  ([83449b8](https://github.com/hayes/giraphql/commit/83449b8))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.12.0 - 2021-08-03

#### 🚀 Updates

- add relay integration for prisma plugin
  ([e714e54](https://github.com/hayes/giraphql/commit/e714e54))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.12.0-alpha.0 - 2021-08-02

#### 🚀 Updates

- add relay integration for prisma plugin
  ([0b1d378](https://github.com/hayes/giraphql/commit/0b1d378))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.11.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.10.0 - 2021-07-29

#### 🐞 Fixes

- create start and end cursors even if edges are null
  ([64b9d2f](https://github.com/hayes/giraphql/commit/64b9d2f))

#### 📘 Docs

- update relay docs with info on re-using types created for relayMutationField
  ([2000f90](https://github.com/hayes/giraphql/commit/2000f90))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.10.0-alpha.0 - 2021-07-28

#### 🚀 Updates

- expose input and object ref from relayMutationField
  ([af5a061](https://github.com/hayes/giraphql/commit/af5a061))

#### 🐞 Fixes

- improve handling of null edges in resolveConnection helpers
  ([6577a00](https://github.com/hayes/giraphql/commit/6577a00))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.9.2 - 2021-07-23

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.9.2-alpha.0 - 2021-07-17

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.9.1 - 2021-07-10

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.9.0 - 2021-07-04

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.9.0-alpha.1 - 2021-07-04

#### 🚀 Updates

- add early warning for undefined refs to simplify debugging of circular import issues
  ([095b68b](https://github.com/hayes/giraphql/commit/095b68b))

#### 📦 Dependencies

- upgrade typescript ([675f6a2](https://github.com/hayes/giraphql/commit/675f6a2))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.9.0-alpha.0 - 2021-07-03

#### 🚀 Updates

- **[relay]** add connectionObject helper, cursorType option, and more field options
  ([466b61f](https://github.com/hayes/giraphql/commit/466b61f))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.8.1 - 2021-07-02

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.8.0 - 2021-07-02

#### 🚀 Updates

- add option to make clientMutationField optional, or omit it entirly
  ([95a74bb](https://github.com/hayes/giraphql/commit/95a74bb))
- update deno ([382775e](https://github.com/hayes/giraphql/commit/382775e))

#### 🛠 Internals

- update relay tests to account for new options
  ([ea363b9](https://github.com/hayes/giraphql/commit/ea363b9))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.7.0 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.7.0-alpha.1 - 2021-06-28

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.7.0-alpha.0 - 2021-06-28

#### 🚀 Updates

- add errors plugin ([88509b4](https://github.com/hayes/giraphql/commit/88509b4))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.6.0 - 2021-06-11

#### 🚀 Updates

- make field options args optional when empty
  ([ae71648](https://github.com/hayes/giraphql/commit/ae71648))

#### 🐞 Fixes

- fix a couple type errors ([453bf7b](https://github.com/hayes/giraphql/commit/453bf7b))

#### 📦 Dependencies

- update dev deps ([813d9d0](https://github.com/hayes/giraphql/commit/813d9d0))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.5.0 - 2021-06-10

#### 🚀 Updates

- update deno ([d7350f9](https://github.com/hayes/giraphql/commit/d7350f9))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.5.0-alpha.0 - 2021-06-09

#### 🚀 Updates

- plum parentShape through all ussage of output refs
  ([2dac2ca](https://github.com/hayes/giraphql/commit/2dac2ca))

#### 📘 Docs

- fix a couple typos ([e2d41f7](https://github.com/hayes/giraphql/commit/e2d41f7))
- update docs on edge and connection fields
  ([63b4b52](https://github.com/hayes/giraphql/commit/63b4b52))
- update relay readme and add troubleshooting guide
  ([56350e8](https://github.com/hayes/giraphql/commit/56350e8))

#### 🛠 Internals

- fix tests ([7137675](https://github.com/hayes/giraphql/commit/7137675))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.4.0 - 2021-05-31

#### 🚀 Updates

- add relayMutation method ([a058430](https://github.com/hayes/giraphql/commit/a058430))

#### 🐞 Fixes

- add builder options for generated fields and args
  ([b3edb2c](https://github.com/hayes/giraphql/commit/b3edb2c))
- rename resultFuelds to outputFields ([b5e101d](https://github.com/hayes/giraphql/commit/b5e101d))

#### 🛠 Internals

- add tests for relayMutation options ([1295347](https://github.com/hayes/giraphql/commit/1295347))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.4.0-alpha.2 - 2021-05-29

#### 🐞 Fixes

- add builder options for generated fields and args
  ([52a218a](https://github.com/hayes/giraphql/commit/52a218a))

#### 🛠 Internals

- add tests for relayMutation options ([656b1c0](https://github.com/hayes/giraphql/commit/656b1c0))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.4.0-alpha.1 - 2021-05-29

#### 🐞 Fixes

- rename resultFuelds to outputFields ([e00be1b](https://github.com/hayes/giraphql/commit/e00be1b))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.4.0-alpha.0 - 2021-05-29

#### 🚀 Updates

- add relayMutation method ([57e3d7a](https://github.com/hayes/giraphql/commit/57e3d7a))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.3.0 - 2021-05-28

#### 🚀 Updates

- add globalConnectionField methods for extending connection objects
  ([a22e7e3](https://github.com/hayes/giraphql/commit/a22e7e3))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.2.6 - 2021-05-26

#### 🐞 Fixes

- Make relay connection args optional explicitly
  ([5eb1390](https://github.com/hayes/giraphql/commit/5eb1390))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.2.5 - 2021-05-18

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.2.4 - 2021-05-13

#### 📘 Docs

- add docs for loadableNode ([1ae01e8](https://github.com/hayes/giraphql/commit/1ae01e8))

#### 🛠 Internals

- add tests for loadableNode ([c1b49a0](https://github.com/hayes/giraphql/commit/c1b49a0))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.2.3 - 2021-05-12

#### 🛠 Internals

- udate dev deps ([3251227](https://github.com/hayes/giraphql/commit/3251227))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.2.2 - 2021-05-10

#### 🐞 Fixes

- update ci build command ([7e1d1d2](https://github.com/hayes/giraphql/commit/7e1d1d2))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.2.1 - 2021-05-10

#### 🐞 Fixes

- force new version to fix esm build issue
  ([25f1fd2](https://github.com/hayes/giraphql/commit/25f1fd2))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.2.0 - 2021-05-10

#### 🚀 Updates

- add esm build for all packages ([d8bbdc9](https://github.com/hayes/giraphql/commit/d8bbdc9))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.1.5 - 2021-05-09

#### 📘 Docs

- update readmes ([07c727b](https://github.com/hayes/giraphql/commit/07c727b))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.1.5-alpha.0 - 2021-05-08

#### 🛠 Internals

- fix up a couple issues in internal types of relay field builder methods
  ([1131f42](https://github.com/hayes/giraphql/commit/1131f42))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.1.4 - 2021-05-05

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.1.3 - 2021-05-05

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.1.3-alpha.0 - 2021-05-05

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.1.2 - 2021-05-02

#### 🛠 Internals

- force version bumps and update validation to 2.0 range
  ([07730b3](https://github.com/hayes/giraphql/commit/07730b3))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.1.1 - 2021-05-02

#### 🛠 Internals

- migrate to @beemo/dev for dev tool configs
  ([1da1283](https://github.com/hayes/giraphql/commit/1da1283))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.1.0 - 2021-04-16

#### 📘 Docs

- add docs for validation plugin ([f7d83bf](https://github.com/hayes/giraphql/commit/f7d83bf))

**Note:** Version bump only for package @giraphql/plugin-relay

## 2.1.0-alpha.0 - 2021-04-12

#### 🚀 Updates

- add globalID and globalIDList methods to InputFieldBuilder
  ([1048354](https://github.com/hayes/giraphql/commit/1048354))

#### 📦 Dependencies

- update dev dependencies ([25a15d4](https://github.com/hayes/giraphql/commit/25a15d4))
- update dev deps ([cbfa0a4](https://github.com/hayes/giraphql/commit/cbfa0a4))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.0.4 - 2021-03-28

#### 🐞 Fixes

- **[relay]** include extra fields defined for connections and edges
  ([2b29e3a](https://github.com/hayes/giraphql/commit/2b29e3a))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.0.3 - 2021-03-16

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.0.2 - 2021-02-21

#### 🐞 Fixes

- restore missing exports in relay plugin
  ([2630250](https://github.com/hayes/giraphql/commit/2630250))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.0.1 - 2021-02-19

**Note:** Version bump only for package @giraphql/plugin-relay

# 2.0.0 - 2021-02-16

#### 💥 Breaking

- update plugin exports and names to be more consistent
  ([ee07b35](https://github.com/hayes/giraphql/commit/ee07b35))

#### 🐞 Fixes

- restore globalId helper function exports in relay plugin
  ([16d8a0c](https://github.com/hayes/giraphql/commit/16d8a0c))

#### 📦 Dependencies

- update dependencies and add license files
  ([cb0d102](https://github.com/hayes/giraphql/commit/cb0d102))

#### 📘 Docs

- add more docs o writing plugins ([b996fc6](https://github.com/hayes/giraphql/commit/b996fc6))
- wip - plugin guide ([cf9c6ec](https://github.com/hayes/giraphql/commit/cf9c6ec))

**Note:** Version bump only for package @giraphql/plugin-relay

### 2.0.0-alpha.1 - 2021-02-10

#### 🛠 Internals

- fix broken dev deps ([7af8a0a](https://github.com/hayes/giraphql/commit/7af8a0a))

**Note:** Version bump only for package @giraphql/plugin-relay

# 2.0.0-alpha.0 - 2021-02-10

#### 💥 Breaking

- bump peer deps to 2.0 range ([2a0fae8](https://github.com/hayes/giraphql/commit/2a0fae8))

**Note:** Version bump only for package @giraphql/plugin-relay

### 1.4.1 - 2021-02-07

#### 🐞 Fixes

- specify @giraphql/core as peer and dev dep so it is updated correctly
  ([f096393](https://github.com/hayes/giraphql/commit/f096393))

**Note:** Version bump only for package @giraphql/plugin-relay

# [1.3.0](https://github.com/hayes/giraphql/compare/@giraphql/plugin-relay@1.3.0-alpha.0...@giraphql/plugin-relay@1.3.0) (2020-10-21)

**Note:** Version bump only for package @giraphql/plugin-relay

# Changelog

### 1.2.0

Add options objects for auto generated `node` and `nodes` queries, as well as the `Node` and
`PageInfo` types.

### 1.1.0

Fixed issues with isTypeOf and ids on nodes.

### 1.0.0

Initial release
