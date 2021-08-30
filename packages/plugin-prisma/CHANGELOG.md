# Change Log

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

  ```ts
  import PrismaPlugin, { PrismaTypes } from '@giraphql/plugin-prisma';

  export default new SchemaBuilder<{}>({
    prisma: {
      client: prisma,
    },
  });
  ```

  You will also need to replace model names with the prisma delegates from your prisma client like
  the following:

  ```ts
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
          prisma.user.findUnique({
            ...query,
            rejectOnNotFound: true,
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
