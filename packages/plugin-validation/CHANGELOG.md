# @pothos/plugin-validation

## 4.3.1

### Patch Changes

- 76e06e7: Rebuild with TypeScript 7. Source files now use explicit `.js` import extensions (enforced by
  lint) instead of adding them during the build, and declaration files are emitted by TypeScript
  7's compiler. Published output is functionally unchanged.

## 4.3.0

### Minor Changes

- b494289: Propagate prototype of validation issues to preserve structured errors

## 4.2.0

### Minor Changes

- 29ae6ed: Add unsafelyHandleInputErrors option for handling validation errors

### Patch Changes

- 29ae6ed: Export InputValidationError

## 4.1.1

### Patch Changes

- 3403c66: update dependencies

## 4.1.0

### Minor Changes

- 689accd: Fix validation for nested lists and ensure that type level schemas are always run on the objects rather than lists of objects

## 4.0.1

### Patch Changes

- 745cc6e: Fix a bug that caused schemas on nested input fields to be executed twice
