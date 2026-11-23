---
'@pothos/selection-mapper': patch
---

Fix relations being reloaded for every row under graphql-yoga with graphql 17 (`@graphql-tools/executor` 2). Loader mappings were keyed on `info.getAbortSignal`, which that executor builds anew for every resolver, so no resolver found the mapping its parent recorded. Executions are now told apart by the root link of their path under every executor that shares path links, and by their `variableValues` under graphql-jit. This affects plugin-prisma, plugin-drizzle and plugin-prisma-next.
