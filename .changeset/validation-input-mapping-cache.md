---
'@pothos/plugin-validation': patch
'@pothos/core': patch
---

Fix slow schema builds with plugin-validation on schemas with many interconnected input types. plugin-validation now shares its input type mappings between fields, and `mapInputFields` reuses its filtered results across calls that share a cache, so each input type is only processed once per schema build.
