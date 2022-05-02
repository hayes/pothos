---
'@pothos/core': patch
'@pothos/deno': patch
'@pothos/plugin-relay': patch
---

Fix issue with argument mapping utils that caused nested lists of input objects to be transformed
incorrectly in the relay plugin
