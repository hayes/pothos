---
'@pothos/plugin-dataloader': minor
'@pothos/plugin-prisma': minor
'@pothos/plugin-relay': minor
'@pothos/core': minor
---

- allow connection fields (edges / pageInfo) to be promises
- add completeValue helper to core for unwrapping MaybePromise values
- set nodes as null if edges is null and the field permits a null return
