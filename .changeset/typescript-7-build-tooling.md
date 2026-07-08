---
'@pothos/converter': patch
'@pothos/core': patch
'@pothos/plugin-add-graphql': patch
'@pothos/plugin-complexity': patch
'@pothos/plugin-dataloader': patch
'@pothos/plugin-directives': patch
'@pothos/plugin-drizzle': patch
'@pothos/plugin-errors': patch
'@pothos/plugin-example': patch
'@pothos/plugin-federation': patch
'@pothos/plugin-grafast': patch
'@pothos/plugin-mocks': patch
'@pothos/plugin-prisma-utils': patch
'@pothos/plugin-prisma': patch
'@pothos/plugin-relay': patch
'@pothos/plugin-scope-auth': patch
'@pothos/plugin-simple-objects': patch
'@pothos/plugin-smart-subscriptions': patch
'@pothos/plugin-sub-graph': patch
'@pothos/plugin-tracing': patch
'@pothos/plugin-validation': patch
'@pothos/plugin-with-input': patch
'@pothos/plugin-zod': patch
'@pothos/test-utils': patch
'@pothos/tracing-newrelic': patch
'@pothos/tracing-opentelemetry': patch
'@pothos/tracing-sentry': patch
'@pothos/tracing-xray': patch
---

Rebuild with TypeScript 7. Source files now use explicit `.js` import extensions (enforced by
lint) instead of adding them during the build, and declaration files are emitted by TypeScript
7's compiler. Published output is functionally unchanged.
