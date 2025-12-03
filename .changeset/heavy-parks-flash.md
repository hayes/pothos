---
"@pothos/plugin-prisma": minor
---

The `dmmf` option is now required when configuring the Prisma plugin. This is necessary because Prisma 7 no longer exposes DMMF data on the client internals.

## Migration

Import `getDatamodel` from your generated Pothos types and pass it to the prisma config:

```typescript
import PrismaPlugin from '@pothos/plugin-prisma';
import { PrismaClient } from './prisma/client';
import { getDatamodel } from './prisma/generated';

const prisma = new PrismaClient();

const builder = new SchemaBuilder({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(), // Required in Prisma 7
  },
});
```
