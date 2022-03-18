---
"@pothos/plugin-relay": patch
---

Explicitly make `pageInfo` non nullable. Previously `pageInfo` was nullable for `defaultFieldNullability: true`, which is against the Relay spec.
