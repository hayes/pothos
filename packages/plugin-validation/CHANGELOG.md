# @pothos/plugin-validation

## 4.3.3

### Patch Changes

- e470938: Run chained input object schemas in declaration order
  Keep chained input type schemas when the input type also sets a `validate` option
  Continue validator chains after a schema successfully transforms a value to `null`

  Behavior change: chaining `.validate()` on an input type that also passes a `validate` option previously dropped the chained schemas entirely. They now run, in declaration order, followed by the options schema — the same order already used for arguments and input fields. Because the options schema runs last, a chained schema that reshapes the value (so the options schema no longer matches the reshaped value) can now fail at runtime where it previously silently returned the options schema's output. Note that `.validate()` re-types the input ref while the `validate` option does not, so TypeScript still describes the value as the last chained schema's output in that case.

## 4.3.2

### Patch Changes

- c4857a1: Report validation issues from every field of an input object instead of stopping after the first field that fails. When the type-level schemas for a field fail, the field-level schemas for that field are no longer run against the failed result, list-level schemas now wait for async type-level schemas of list items to complete, type-level schemas still run for list items whose nested fields passed when a sibling item failed, and async nested field failures inside list items no longer reject with a promise chaining error.

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
