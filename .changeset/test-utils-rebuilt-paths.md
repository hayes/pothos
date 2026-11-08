---
'@pothos/test-utils': minor
---

Add `rebuildResolverPaths`, which hands a schema's resolvers their info as graphql-jit builds it, for testing code that reads `info.path`.

Add `infoAt`, which builds the info of another field in the same execution, with the path its executor would give it.
