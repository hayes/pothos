import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'tests/prisma-types-from-client/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
