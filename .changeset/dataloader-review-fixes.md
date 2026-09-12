---
"@pothos/plugin-dataloader": patch
---

Support iterable (non-array) results from list field resolvers in the loader wrappers
Load ids nested inside lists of lists instead of only the outer list, keeping each list position's error and nullability boundary intact
Preserve caller provided extensions on `loadableUnion`
