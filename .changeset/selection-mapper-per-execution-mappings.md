---
'@pothos/selection-mapper': patch
---

Loader mappings are recorded per execution, and per event for subscriptions, under graphql-js, graphql-jit and `@graphql-tools/executor` (Yoga). Operations or subscription events that share a context no longer resolve a row from a mapping another execution recorded. A subscription event is told apart by its payload, so an event whose payload isn't an object records no mappings and its relations load their own data. Executions are told apart without their paths, so under graphql-jit, which builds a new path for every resolver, planned relations no longer load again for every row.
