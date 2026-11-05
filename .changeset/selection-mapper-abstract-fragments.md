---
'@pothos/selection-mapper': minor
---

- Fields in a fragment on an abstract type without a model (such as `... on Node` beneath a model interface) are now planned for each type the fragment covers, so the parent query loads them. If those types' selections conflict, the fragment is left to the fallback.
- Repeated selection sets are planned once and shared, so planning time grows linearly with the document's depth. Reading `Position.parent` turns off sharing for that walk. Use `Position.walkParent` to read the shared walk's parents instead. Beneath a fragment on an abstract type without a model, a field the document also selects on the model interface is planned once, on the interface, rather than once per implementation.
- `deepEqual` no longer throws on Temporal values. It compares plain objects, arrays and Dates by value, and any other object with its `equals` method, or by identity.
- `Plan.forParentRow` takes an options object: `forParentRow(adapter, { context, info, skipDeferredFragments, initial })`. The `Mapping` and `ParentRowOptions` types are exported.
- Errors raised while planning a request, such as a conflict between the type-level selections of two variants or a select that returned before its nested selection settled, now reach clients as `Unexpected error.`, still a `PothosValidationError`. The detail is in the error's `cause`.
- `mappingParentTypes` lists the types a field's resolver looks up loader mappings under: its parent type, and the interfaces with a model whose own field of that name it inherits.
