---
'@pothos/plugin-dataloader': minor
---

Fix `loadableObject`, `loadableObjectRef`, `loadableInterfaceRef`, and `loadableNodeRef` to infer the object `Shape` with `Error` excluded from the `load` result union. Previously a `load` method resolving to `Shape | Error` caused dependent field and resolver types to incorrectly include `Error`.
