---
'@pothos/selection-mapper': patch
---

Loader mappings are recorded per execution. Operations or subscription events that share a context no longer resolve a row from a mapping another execution recorded. Executions are told apart without their paths, so under graphql-jit, which builds a new path for every resolver, planned relations no longer load again for every row.
