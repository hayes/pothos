---
'@giraphql/plugin-prisma': minor
---

Re-designed how types are propagated in the prisma plugin to improve performance. This requires a
slight change to the how the builder is set up.

You will now need to do the following in your builder setup:

```ts
import PrismaPlugin, { PrismaTypes } from '@giraphql/plugin-prisma';

export default new SchemaBuilder<{
  // User `PrismaTypes` with the `PrismaTypes` helper rather than `PrismaClient`
  PrismaTypes: PrismaTypes<typeof prisma>;
}>({
  prisma: {
    client: prisma,
  },
});
```
