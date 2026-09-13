---
"@pothos/plugin-scope-auth": patch
---

Cache the names returned by a type grant function, then install those grants at every response path where the object appears. Reusing an object across aliases or list positions no longer denies fields after the first occurrence.
