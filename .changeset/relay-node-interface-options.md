---
'@pothos/plugin-relay': minor
---

`builder.nodeInterfaceRef` accepts `Node` interface options, such as `authScopes`, so they can be set after the builder is created and reference node types. They override the same options from `relay.nodeTypeOptions`, and `extensions` are merged.
