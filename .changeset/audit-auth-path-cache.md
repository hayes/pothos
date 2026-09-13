---
"@pothos/plugin-scope-auth": patch
---

When the same object appears under granted and ungranted response paths, cache the type authorization function result and evaluate its grant requirements at each path. This prevents a granted sibling from authorizing an ungranted sibling while preserving one function invocation per object.
