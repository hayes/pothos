# @pothos/selection-mapper

## 0.2.0

### Minor Changes

- f42670b: - Fields in a fragment on an abstract type without a model (such as `... on Node` beneath a model interface) are now planned for each type the fragment covers, so the parent query loads them. If those types' type-level selections conflict, planning fails, as it does for fragments that name the types.
  - Repeated selection sets are planned once and shared, so planning time grows linearly with the document's depth. Reading `Position.parent` turns off sharing for that walk. Use `Position.walkParent` to read the shared walk's parents instead. Beneath a fragment on an abstract type without a model, a field the implementations inherit from the model interface is planned once, on the interface, rather than once per implementation.
  - `deepEqual` no longer throws on Temporal values. It compares plain objects, arrays and Dates by value, and any other object with its `equals` method, or by identity.
  - `Plan.forParentRow` takes an options object: `forParentRow(adapter, { context, info, skipDeferredFragments, initial })`. The `Mapping` and `ParentRowOptions` types are exported.
  - Errors raised while planning a request, such as a conflict between the type-level selections of two variants or a select that returned before its nested selection settled, now reach clients as `Unexpected error.`, still a `PothosValidationError`. The detail is in the error's `cause`.
  - `mappingParentTypes` lists the types a field's resolver looks up loader mappings under: its parent type, and the interfaces with a model whose own field of that name it inherits.
  - `getLoaderMapping` takes the resolver's `info` in place of its path: `getLoaderMapping(context, info, type, row)`.
  - `forOperation(cache, info)` returns the entries of a `WeakMap` cache for the operation `info` is in, for plugins that cache plans per operation.
- 8686c06: `fieldKey(type, info)` keys a plan cached for a field on the type, the response path and the field nodes graphql merged for it, so fragments on different types that reach one response path get separate plans.

  `forExecution(cache, info)` keeps entries per execution, as loader mappings are kept, so each subscription event gets its own.

### Patch Changes

- 9fbe606: A `nestedSelection` path that doesn't fit the field's type (a field or pinned type the schema doesn't have, or a segment that isn't an object or interface) now reaches clients as `Unexpected error.`, with the detail in the error's `cause`.
- c2fa676: Loader mappings are recorded per execution, and per subscription event, under graphql-js, graphql-jit and `@graphql-tools/executor` (Yoga), so operations and events sharing a context don't read each other's. An execution is told apart by the `getAbortSignal` graphql-js 17 passes, by the root link of its path under graphql-js 16 and `@graphql-tools/executor`, and by its `variableValues` under graphql-jit. Under graphql-jit, planned relations no longer load again for every row.

  `getLoaderMapping` returns `null` for a row with no plan recorded above it, instead of the mapping recorded for another row at the same response path.
