# Change Log

## 3.11.1

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.11.0

### Minor Changes

- bf0385ae: Add new PothosError classes

## 3.10.1

### Patch Changes

- 372260ec: Fix bug that prevented prisma from correctly including selections when using the
  directResult option from the errors plugin

## 3.10.0

### Minor Changes

- ecc1d6f8: Add `defaultGetTypeName` option to `@pothos/plugin-errors`, this option allows
  customizing the generated type names by this plugin.

  An example usage of this:

  ```ts
  export const builderWithCustomErrorTypeNames = new SchemaBuilder<{}>({
    plugins: [ErrorPlugin, ValidationPlugin],
    errorOptions: {
      defaultTypes: [Error],
      defaultResultOptions: {
        name: ({ parentTypeName, fieldName }) => `${fieldName}_CustomResult`,
      },
      defaultUnionOptions: {
        name: ({ parentTypeName, fieldName }) => `${fieldName}_CustomUnion`,
      },
    },
  });
  ```

## 3.9.0

### Minor Changes

- cd1c0502: Add support for nested lists

## 3.8.7

### Patch Changes

- d4d41796: Update dev dependencies

## 3.8.6

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 3.8.5

### Patch Changes

- b12f9122: Fix issue with esm build script

## 3.8.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 3.8.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 3.8.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 3.8.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 3.8.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 3.7.1

### Patch Changes

- aa18acb7: update dev dependencies

## 3.7.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 3.6.0

### Minor Changes

- 09572175: Add builder options for default union and result type options

## 3.5.1

### Patch Changes

- 3ead60ae: update dev deps

## 3.5.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 3.4.2

### Patch Changes

- 4e5756ca: Update dev dependencies

## 3.4.1

### Patch Changes

- 4b24982f: Update dev dependencies

## 3.4.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

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

## 2.13.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 2.12.3

### Patch Changes

- 2b08f852: Fix syntax highlighting in docs and update npm README.md files"

## 2.12.2

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

## 2.12.1

### Patch Changes

- c85dc33: Add types entry in package.json

## 2.12.0

### Minor Changes

- aeef5e5: Update dependencies

## 2.11.0

### Minor Changes

- 9107f29: Update dependencies (includes graphql 16)

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
