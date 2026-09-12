---
"@pothos/plugin-sub-graph": patch
---

Remap custom directive argument types to the rebuilt sub-graph types instead of reusing the originals, and throw when a directive argument references a type that is not part of the sub-graph rather than publishing the excluded type
Preserve the schema description when creating a sub-graph
