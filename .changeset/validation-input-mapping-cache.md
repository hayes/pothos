---
'@pothos/plugin-validation': patch
'@pothos/core': patch
---

Fix slow schema builds when input types are reused across many fields. plugin-validation now shares its input type mappings between fields, and `mapInputFields` reuses its filtered results across calls that share a cache and skips rebuilding field configs for input types it has already mapped. This also speeds up plugin-relay, plugin-zod and plugin-prisma-utils.
