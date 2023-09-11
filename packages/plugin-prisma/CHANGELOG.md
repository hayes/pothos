# Change Log

## 3.59.2

### Patch Changes

- 0d8d60fa: add another case for @skip and @include when generating prisma selections

## 3.59.1

### Patch Changes

- 1fc5b60b: Support Client Directives in Prisma plugin (@skip and @include)

## 3.59.0

### Minor Changes

- 1bbd3d70: update model loader to cache query mappings and batch compatible queries to reduce
  likelyhood of prisma deoptimization

## 3.58.0

### Minor Changes

- 4ebfa27b: Add prismaInterfaceField(s) method

### Patch Changes

- 4ebfa27b: Fix bug that ignored differences in Date values when checking compatability between
  selections

## 3.57.0

### Minor Changes

- c7756128: Improve typing for t.expose methods when strict mode is disabled

## 3.56.1

### Patch Changes

- 016011f2: Fix custom descriptions in t.expose methods

## 3.56.0

### Minor Changes

- Fix unused query check for prismaConnections

## 3.55.0

### Minor Changes

- 39237239: Add builder.prismaInterface to allow interface variants of a prisma model

## 3.54.0

### Minor Changes

- 7494da05: Add `onUnusedQuery` option to the prisma plugin options

## 3.53.0

### Minor Changes

- 5d3f7b97: Improve inference for t.expose methods on prisma field builder

## 3.52.0

### Minor Changes

- 624f2d05: Add optimizations for nodes field on connections

## 3.51.1

### Patch Changes

- e8139e73: Fixed a bug where totalCount was not selected correctly when selected through a fragment

## 3.51.0

### Minor Changes

- dbdb6f03: Fix compatability with prisma@4.13.*

## 3.50.1

### Patch Changes

- 5b6007cd: Prevent unavailable prisma CreateInput types from being referenced by pothos generated
  types.

## 3.50.0

### Minor Changes

- 27b0638d: Update plugin imports so that no named imports are imported from files with side-effects

## 3.49.1

### Patch Changes

- b39e7eab: Fix bug where queryFromInfo would default to the wrong type when setting path without
  also specifying a typeName

## 3.49.0

### Minor Changes

- 0c042150: Allow globalConnectionFields to be overwritten on specific connections

## 3.48.0

### Minor Changes

- b3259d3e: Make parent and args available in connection and edge fields of prisma connections

## 3.47.3

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.47.2

### Patch Changes

- 14f8cd5c: Fix returning nulls from nullable prismaConnections

## 3.47.1

### Patch Changes

- 80c62446: Fix issue with connection helpers and extendedWhereUnique

## 3.47.0

### Minor Changes

- 5ea5ce24: Allow t.relatedConnection to override take, skip, and cursor in the query option

## 3.46.0

### Minor Changes

- 1878d5d9: Allow readonly arrays in more places

## 3.45.0

### Minor Changes

- e5295551: Add initial support for mutation input in prisma utils
- 72bd678a: Add new prismaUtils feature flag to the generator

## 3.44.0

### Minor Changes

- 07bf6d4f: Simplify how relations are defined in PrismaTypes
- 93bd2842: Support typescript@5.0

## 3.43.0

### Minor Changes

- e8d75349: - allow connection fields (edges / pageInfo) to be promises
  - add completeValue helper to core for unwrapping MaybePromise values
  - set nodes as null if edges is null and the field permits a null return

## 3.42.0

### Minor Changes

- 384bc124: Add nullability option to prismaNode

## 3.41.3

### Patch Changes

- 853f3cfb: Fix hasPreviousPage for connections using only last

## 3.41.2

### Patch Changes

- 687c6e2d: Fix `last` when used without `before`

## 3.41.1

### Patch Changes

- 592ffd3b: Fix name option for prismaNode

## 3.41.0

### Minor Changes

- bf0385ae: Add new PothosError classes

## 3.40.3

### Patch Changes

- 372260ec: Fix bug that prevented prisma from correctly including selections when using the
  directResult option from the errors plugin

## 3.40.2

### Patch Changes

- 98c6e801: Fix issue when using path and typeName together in resolveQueryFromInfo

## 3.40.1

### Patch Changes

- 5c6e0abb: Add placeholder generated file with instructions to run `prisma generate`

## 3.40.0

### Minor Changes

- 75d13217: Export utils for formatting prisma cursors

## 3.39.0

### Minor Changes

- c3db3bcd: Enable adding interfaces to connections and edges

## 3.38.1

### Patch Changes

- 943cb073: import from @prisma/client/index.js for esm generated types

## 3.38.0

### Minor Changes

- 41426ee7: Add export specifier and esm output for generated prisma types

## 3.37.0

### Minor Changes

- 26774fa0: Rewrite prismaConnectionHelpers to properly work with indirect relations

## 3.36.0

### Minor Changes

- 8841e861: Add builder.prismaObjectField(s) method to extend prisma objects and simplify defining
  circular relationships
- cd1c0502: Add support for nested lists
- 99bc6574: Add initial support for reusable prisma connections

## 3.35.8

### Patch Changes

- d4d41796: Update dev dependencies

## 3.35.7

### Patch Changes

- b6be576d: Fix typing for nullable prisma connections

## 3.35.6

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 3.35.5

### Patch Changes

- b12f9122: Fix issue with esm build script

## 3.35.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 3.35.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 3.35.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 3.35.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 3.35.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 3.34.1

### Patch Changes

- aa18acb7: update dev dependencies

## 3.34.0

### Minor Changes

- a76616e0: Add prismaFieldWithInput method

## 3.33.0

### Minor Changes

- cf93c7c9: Fix some edge cases with how option objects become optional when no arguments are
  required

## 3.32.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 3.31.1

### Patch Changes

- 47fea5ed: Fix: add .ts extension to filename for generated prisma fields

## 3.31.0

### Minor Changes

- 50a60d92: Support prisma filtered relations counts

### Patch Changes

- e297e78a: Support typescript@4.8

## 3.30.0

### Minor Changes

- 521cde32: Improve how default output location for prisma types is calculated

## 3.29.0

### Minor Changes

- 76d50bb4: Fix import of cjs graphql file in esm pothos

## 3.28.0

### Minor Changes

- 390e74a7: Add `idFieldOptions` to relay plugin options

## 3.27.2

### Patch Changes

- 193ac71a: Support `fullTextSearch` types (#553)

## 3.27.1

### Patch Changes

- 222298f0: update curor type on query arg of prismaConnections

## 3.27.0

### Minor Changes

- c5b1e2d3: move addBrand and hasBrand from PrismaNodeRef to PrismaObjectRef so it can be used with
  all prisma objects
- c5b1e2d3: Only use abstractReturnShapeKey when resolveType is not provided

## 3.26.0

### Minor Changes

- 5423703a: expose queryFromInfo from prisma plugin

## 3.25.0

### Minor Changes

- 82596ec2: remove duplicate Fields from generated prisma types

## 3.24.0

### Minor Changes

- 5e71c283: update queryFromInfo to support indirect paths

## 3.23.0

### Minor Changes

- 33789284: Update cursor encoding to work in deno
- 33789284: Fix default connection size when using "before"
- 33789284: Support setting max and default cursor sizes based in args or context

## 3.22.0

### Minor Changes

- 13216a3d: remove all remaining circular imports

## 3.21.2

### Patch Changes

- c102f522: Fix withAuth on prismaObject fields builders

## 3.21.1

### Patch Changes

- a02b25c2: Fix regression in compatibility between prisma and simple objects plugins"

## 3.21.0

### Minor Changes

- 3ead60ae: Add option to use comments from prisma schema as graphql descriptions

### Patch Changes

- 3ead60ae: update dev deps

## 3.20.0

### Minor Changes

- f7f74585: Add option for configuring name of id field for relay nodes

## 3.19.0

### Minor Changes

- 6382f65b: Fix types when using prismaField with `select` on a PrismaObject

## 3.18.0

### Minor Changes

- 360836e5: Fix issue with prismaField not inferring parent thpe for subscriptions

## 3.17.0

### Minor Changes

- c50b9197: Support BigInt cursors

## 3.16.0

### Minor Changes

- 86c16787: Allow dmmf to be passed from Prisma.dmmf

## 3.15.0

### Minor Changes

- dad7fb43: Fix typing for fallback resolvers on relation fields, and correclty pass all query
  properties for relatedConnections

## 3.14.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 3.13.2

### Patch Changes

- f58ad8fa: Fix type error introduced by withAuth helper

## 3.13.1

### Patch Changes

- 04ed2b0c: Fix args in plugin methods on connection fields sometimes not being typed correctly

## 3.13.0

### Minor Changes

- 7311904e: Support uniqueIndexes as connection cursors
- 7311904e: Add withAuth method to return a field builder to allow custom auth context with other
  plugin methods
- 7311904e: Use findUniqueOrThrow rather than rejectOnNotFound if available

### Patch Changes

- 7311904e: Fix connection with empty select
- 7311904e: Update dev deps

## 3.12.1

### Patch Changes

- c8f75aa1: Update dev dependencies

## 3.12.0

### Minor Changes

- 4d414fb5: Add support for prisma@4

## 3.11.0

### Minor Changes

- 79e69c2b: Add resolveCursorConnection helper for relay plugin

## 3.10.0

### Minor Changes

- 384b0fb6: Make findUnique optional by defaulting to id/unique fields defined in prisma schema

## 3.9.0

### Minor Changes

- e090a835: Add fieldWithSelection method to support indirect relions

### Patch Changes

- 4e5756ca: Update dev dependencies

## 3.8.0

### Minor Changes

- 4154edc9: Add isNull option to prisma variant fields

## 3.7.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.6.1

### Patch Changes

- 205a8c73: Recactor internal imports to reduce imports from index files

## 3.6.0

### Minor Changes

- ce1063e3: Add new tracinig packages

### Patch Changes

- ce1063e3: Fix issue with fields selects when created created with functions

## 3.5.0

### Minor Changes

- 05163ca5: Add support for dynamically loading prisma client and selecting counts in field level
  selects"

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

## 3.1.2

### Patch Changes

- 1bf0cd00: Add typescript version check for prisma generator

## 3.1.1

### Patch Changes

- 86718e08: Make lookups on extensions objects compatible with older graphql versions

## 3.1.0

### Minor Changes

- 8add0378: Add `totalCount` option to `prismaConnection`

## 3.0.0

### Minor Changes

- 9b6353d4: Use Promise.resolve instead of setTimeout to batch fallback operations

## 0.19.0

### Minor Changes

- cf4a2d14: Add support for using selects instead of includes in queries

## 0.18.0

### Minor Changes

- ad8d119b: Add support for composite ids as cursors in connections

### Patch Changes

- ad8d119b: update dev dependencies

## 0.17.2

### Patch Changes

- 03aecf76: update .npmignore

## 0.17.1

### Patch Changes

- c288534e: correctly load type includes when resolving prismaNodes

## 0.17.0

### Minor Changes

- 4ad5f4ff: Normalize resolveType and isTypeOf behavior to match graphql spec behavior and allow
  both to be optional

### Patch Changes

- 43ca3031: Update dev dependencies

## 0.16.3

### Patch Changes

- ab4a9ae4: Fix some type compatibility issues when skipLibCheck is false

## 0.16.2

### Patch Changes

- 2d9b21cd: Use workspace:\* for dev dependencies on pothos packages

## 0.16.1

### Patch Changes

- b58ee414: Fix primaNode variants

## 0.16.0

### Minor Changes

- 044396ea: Add support for multiple variants of the same prisma model

## 0.15.2

### Patch Changes

- a01abb7f: Fix compatability between prisma and auth plugins

## 0.15.1

### Patch Changes

- ce585cca: fix Prisma object parent shape when combined with other plugins

## 0.15.0

### Minor Changes

- 4caad5e4: Rename GiraphQL to Pothos

## 0.14.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 0.13.3

### Patch Changes

- 2b08f852: Fix syntax highlighting in docs and update npm README.md files"

## 0.13.2

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

## 0.13.1

### Patch Changes

- 5619aca: Standardize context caches across all plugins to correctly take advantage of
  `initContextCache`

## 0.13.0

### Minor Changes

- 6d2a6d9: Update to support typescript 4.5. typescript@>4.5.2 is now required for code generation
  in the prisma plugin

## 0.12.1

### Patch Changes

- c85dc33: Add types entry in package.json

## 0.12.0

### Minor Changes

- aeef5e5: Update dependencies

## 0.11.1

### Patch Changes

- 8e7cb89: remove some debug code

## 0.11.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

### Patch Changes

- 53e7905: Correctly pass context to query option of relations and connectedRelations

## 0.10.0

### Minor Changes

- 17db3bd: Make type refs extendable by plugins

## 0.9.2

### Patch Changes

- c976bfe: Update dependencies

## 0.9.1

### Patch Changes

- 4150f92: Fixed esm transformer for path-imports from dependencies

## 0.9.0

### Minor Changes

- dc87e68: update esm build process so extensions are added during build rather than in source

## 0.8.2

### Patch Changes

- b4b8381: Updrade deps (typescript 4.4)

## 0.8.1

### Patch Changes

- 0d655cd: Update README.md

## 0.8.0

### Minor Changes

- f04be64: #### Breaking

  - The Prisma plugin had been re-designed to use a prisma-generator to generate more efficient
    types. This requires new additional setup
  - Restored the original API that used model names as strings rather than passing in prisma
    delegates.

  #### New

  - Added support for `include` options on `prismaObject` and `prismaNode` types that are
    automatically loaded. This allows fields defined directly on those types to use nested relations
    without making additional requests.
  - Added `relationCount` method to prisma field builder and `totalCount` option to
    `relatedConnection` for more loading of counts.

  ### Fixed

  - Fixed some bugs related to field nullability
  - Improved include merging to further reduce the number of queries required to resolve a request

### Patch Changes

- f04be64: Update dependencies

## 0.7.2

### Patch Changes

- cbb4960: Fix priama-connections without relations

## 0.7.1

### Patch Changes

- 2cf9279: fix for models that do not have any relations

## 0.7.0

### Minor Changes

- ea4d456: Add interoperability between prisma and errors plugins

## 0.6.0

### Minor Changes

- 5cdd001: Re-designed how types are propagated in the prisma plugin to improve performance. This
  requires a few breaking changes to how this plugin is used.

  This change was required because of performance issue in typescript which has been reported here:
  https://github.com/microsoft/TypeScript/issues/45405

  If this is fixed, the API may be changed back to the slightly nicer string/name based version.

  You will need to remove PrismaClient from the builder types, so your builder setup now looks like:

  ```typescript
  import PrismaPlugin, { PrismaTypes } from '@giraphql/plugin-prisma';

  export default new SchemaBuilder<{}>({
    prisma: {
      client: prisma,
    },
  });
  ```

  You will also need to replace model names with the prisma delegates from your prisma client like
  the following:

  ```typescript
  builder.prismaObject(prisma.post, {
    findUnique: (post) => ({ id: post.id }),
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      author: t.relation('author'),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      me: t.prismaField({
        type: prisma.user,
        resolve: async (query, root, args, ctx, info) =>
          prisma.user.findUniqueOrThrow({
            ...query,
            where: { id: ctx.userId },
          }),
      }),
    }),
  });
  ```

  See updated docs for more detailed usage.

## 0.5.0

### Minor Changes

- a4c87cf: Use ".js" extensions everywhere and add module and exports to package.json to better
  support ems in node

## 0.4.0

### Minor Changes

- 06e11f9: Pass context to query option of relation and relatedConnection fields

### Patch Changes

- 0d51dcf: Fix nullability of prismaField

## 0.3.2

### Patch Changes

- ee16577: Fix prisma plugin for multi-word model names.
- f13208c: bump to fix latest tag

## 0.3.1

### Patch Changes

- 9ab8fbc: re-release previous version due to build-process issue

## 0.3.0

### Minor Changes

- 3dd3ff14: Updated dev dependencies, switched to pnpm, and added changesets for releases

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

### 0.2.1 - 2021-08-05

#### 📘 Docs

- fix typo ([ef5cff9](https://github.com/hayes/giraphql/commit/ef5cff9))
- fix typo ([dbe3e0e](https://github.com/hayes/giraphql/commit/dbe3e0e))
- fix typo ([eaec7b9](https://github.com/hayes/giraphql/commit/eaec7b9))
- fix typo ([2c366f0](https://github.com/hayes/giraphql/commit/2c366f0))
- improve description of supported connection arguments
  ([e697727](https://github.com/hayes/giraphql/commit/e697727))
- update disclaimer section of prisma docs
  ([4c375cd](https://github.com/hayes/giraphql/commit/4c375cd))

**Note:** Version bump only for package @giraphql/plugin-prisma

## 0.2.0 - 2021-08-03

#### 🚀 Updates

- add relay integration for prisma plugin
  ([e714e54](https://github.com/hayes/giraphql/commit/e714e54))

#### 🐞 Fixes

- merge connection args into relatedConnection queries
  ([762c06f](https://github.com/hayes/giraphql/commit/762c06f))
- update db seeding to give unique createdAt
  ([279349d](https://github.com/hayes/giraphql/commit/279349d))

#### 📘 Docs

- add docs for prisma relay integration
  ([6c6cbd5](https://github.com/hayes/giraphql/commit/6c6cbd5))

#### 🛠 Internals

- update tests with seed data ([f3b053a](https://github.com/hayes/giraphql/commit/f3b053a))

**Note:** Version bump only for package @giraphql/plugin-prisma

### 0.2.0-alpha.1 - 2021-08-02

#### 🐞 Fixes

- merge connection args into relatedConnection queries
  ([cd72880](https://github.com/hayes/giraphql/commit/cd72880))

#### 🛠 Internals

- update tests with seed data ([56fbb7b](https://github.com/hayes/giraphql/commit/56fbb7b))

**Note:** Version bump only for package @giraphql/plugin-prisma

## 0.2.0-alpha.0 - 2021-08-02

#### 🚀 Updates

- add relay integration for prisma plugin
  ([0b1d378](https://github.com/hayes/giraphql/commit/0b1d378))

**Note:** Version bump only for package @giraphql/plugin-prisma

## 0.1.0 - 2021-07-30

#### 🚀 Updates

- add prisma plugin ([d427c82](https://github.com/hayes/giraphql/commit/d427c82))

**Note:** Version bump only for package @giraphql/plugin-prisma
