---
'@pothos/selection-mapper': patch
---

Loader mappings are recorded per execution, and per subscription event, under graphql-js, graphql-jit and `@graphql-tools/executor` (Yoga), so operations and events sharing a context don't read each other's. An execution is told apart by the `getAbortSignal` graphql-js 17 passes, by the root link of its path under graphql-js 16 and `@graphql-tools/executor`, and by its `variableValues` under graphql-jit. Under graphql-jit, planned relations no longer load again for every row.
