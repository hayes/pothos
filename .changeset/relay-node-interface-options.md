---
'@pothos/plugin-relay': minor
---

Add `builder.nodeInterfaceOptions` to set `Node` interface options, such as `authScopes`, after the builder is created, so they can reference node types. It overrides the same options from `relay.nodeTypeOptions` and merges `extensions`.
