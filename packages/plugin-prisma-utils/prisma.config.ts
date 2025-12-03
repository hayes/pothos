import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: 'postgresql://prisma:prisma@localhost:5455/tests?schema=prisma-utils',
  },
});
