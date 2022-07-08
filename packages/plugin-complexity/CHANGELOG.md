# @giraphql/plugin-complexity

## 3.5.0

### Minor Changes

- f58ad8fa: Add complexityFromQuery util for calculating complexity without running a request
- f58ad8fa: Add complexityError option for customizing errors thrown when query exceeds complixity
  limits

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

## 3.1.2

### Patch Changes

- a7d95fca: Fix bug with \_\_typename selected in a Union fragment

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

## 2.5.0

### Minor Changes

- 1d62c1ff: Handle \_\_typename in complexity plugin

## 2.4.0

### Minor Changes

- 9307635a: Migrate build process to use turborepo

## 2.3.2

### Patch Changes

- 2b08f852: Fix syntax highlighting in docs and update npm README.md files"

## 2.3.1

### Patch Changes

- c6aa732: graphql@15 type compatibility fix

## 2.3.0

### Minor Changes

- 48e9fd8: Add missing exports field to package.json

## 2.2.0

### Minor Changes

- 42d210c: Use type only imports to resolve circular dependencies

## 2.1.0

### Minor Changes

- 6d6d54e: Add complexity plugin
