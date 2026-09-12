---
"@pothos/plugin-dataloader": patch
---

Support iterable (non-array) results from list field resolvers in the loader wrappers
Load ids nested inside lists of lists instead of only the outer list, passing `Error` values through so they are still reported at their own path
Preserve caller provided extensions on `loadableUnion`
