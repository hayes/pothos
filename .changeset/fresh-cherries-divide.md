---
'@pothos/plugin-prisma-utils': minor
---

Update AND/OR/NOT on prismaWhere to accept Type or Field refs.

Previously these fields accepted options directly, but will now require a full field definition
(`t.field(options)`) to override the field options. This enables providing a separate subset of
options for And/Or/Not.
