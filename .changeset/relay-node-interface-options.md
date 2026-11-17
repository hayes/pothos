---
'@pothos/plugin-relay': minor
---

`builder.nodeInterfaceRef` accepts `Node` interface options, such as `authScopes`, so they can be set after the builder is created and reference node types. Each option can be set once, in either `relay.nodeTypeOptions` or one `nodeInterfaceRef` call; `extensions` are merged.
