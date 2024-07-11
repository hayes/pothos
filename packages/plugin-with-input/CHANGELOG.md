# @pothos/plugin-with-input

## 4.0.1

### Patch Changes

- 9bd203e: Fix graphql peer dependency version to match documented minumum version
- Updated dependencies [9bd203e]
  - @pothos/core@4.0.1

## 4.0.0

### Major Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- c1e6dcb: update readmes
- 78c469d: rebuild with-input plugin
- bdcb8cd: Fix prismaFieldWithInput
- 03855c2: fix fieldWithInput when used with fieldWithAuth
- 4a7dc40: rebuild with-input plugin
- Updated dependencies [c1e6dcb]
- Updated dependencies [29841a8]
  - @pothos/core@4.0.0

## 4.0.0-next.5

### Patch Changes

- update readmes
- Updated dependencies
  - @pothos/core@4.0.0-next.1

## 4.0.0-next.4

### Patch Changes

- rebuild with-input plugin

## 4.0.0-next.3

### Patch Changes

- fix fieldWithInput when used with fieldWithAuth

## 4.0.0-next.2

### Patch Changes

- rebuild with-input plugin

## 4.0.0-next.1

### Patch Changes

- Fix prismaFieldWithInput

## 4.0.0-next.0

### Major Changes

- 29841a8: Release Pothos v4 🎉 see https://pothos-graphql.dev/docs/migrations/v4 for more details

### Patch Changes

- Updated dependencies [29841a8]
  - @pothos/core@4.0.0-next.0

## 3.10.2

### Patch Changes

- 1ecea46: revert accidental pinning of graphql peer dependency

## 3.10.1

### Patch Changes

- 4c6bc638: Add provinance to npm releases

## 3.10.0

### Minor Changes

- 3776481e: Add `name` option to `typeOptions` of`@pothos/plugin-with-input` to customize the
  default naming of input fields.

  An example usage of this:

  ```ts
  import WithInputPlugin from '@pothos/plugin-with-input';
  const builder = new SchemaBuilder({
    plugins: [WithInputPlugin],
    withInput: {
      typeOptions: {
        name: ({ parentTypeName, fieldName }) => {
          const capitalizedFieldName = `${fieldName[0].toUpperCase()}${fieldName.slice(1)}`;
          // This will remove the default Query/Mutation prefix from the input type name
          if (parentTypeName === 'Query' || parentTypeName === 'Mutation') {
            return `${capitalizedFieldName}Input`;
          }

          return `${parentTypeName}${capitalizedFieldName}Input`;
        },
      },
    },
  });
  ```

## 3.9.7

### Patch Changes

- d4d41796: Update dev dependencies

## 3.9.6

### Patch Changes

- 6f00194c: Fix an issue with esm import transform

## 3.9.5

### Patch Changes

- b12f9122: Fix issue with esm build script

## 3.9.4

### Patch Changes

- 9fa27cf7: Transform dynamic type imports in d.ts files

## 3.9.3

### Patch Changes

- 3a82d645: Apply esm transform to esm d.ts definitions

## 3.9.2

### Patch Changes

- 218fc68b: Fix script for copying ems d.ts definitions

## 3.9.1

### Patch Changes

- 67531f1e: Create separate typescript definitions for esm files

## 3.9.0

### Minor Changes

- 11929311: Update type definitions to work with module: "nodeNext"

## 3.8.1

### Patch Changes

- aa18acb7: update dev dependencies

## 3.8.0

### Minor Changes

- a76616e0: Add prismaFieldWithInput method

## 3.7.0

### Minor Changes

- d67764b5: Make options objecst on toSchema, queryType, and mutationType optional

## 3.6.0

### Minor Changes

- 3a7ff291: Refactor internal imports to remove import cycles

### Patch Changes

- 3a7ff291: Update dev dependencies

## 3.5.0

### Minor Changes

- ecb2714c: Add types entry to export map in package.json and update dev dependencies

  This should fix compatibility with typescripts new `"moduleResolution": "node12"`

## 3.4.0

### Minor Changes

- f0741c42: Set typename on field configs based on usage rather than field builder constructor.

## 3.3.0

### Minor Changes

- a8e31a70: Improve user experience when srtict mode is disabled

## 3.2.0

### Minor Changes

- 241a385f: Add peer dependency on @pothos/core

## 3.1.1

### Patch Changes

- 8e6a4723: Fix issue with setting input requiredness in with-input plugin

## 3.1.0

### Minor Changes

- 6279235f: Update build process to use swc and move type definitions to dts directory

### Patch Changes

- 21a2454e: update dev dependencies

## 3.0.0

### Major Changes

- c0bdbc1b: Initial release of with-input plugin
