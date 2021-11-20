---
'@giraphql/core': patch
'@giraphql/plugin-prisma': patch
'@giraphql/plugin-relay': patch
'@giraphql/plugin-smart-subscriptions': patch
---

Standardize context caches across all plugins to correctly take advantage of `initContextCache`
