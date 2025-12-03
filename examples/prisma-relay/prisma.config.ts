import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: 'file:./prisma/dev.db',
  },
  migrations: {
    seed: 'node -r @swc-node/register prisma/seed.ts',
  },
});
