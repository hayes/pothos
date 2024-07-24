import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './tests/postgres/db/schema.ts',
  out: './tests/postgres/drizzle',
  dbCredentials: {
    url: 'postgresql://prisma:prisma@localhost:5455/drizzle',
  },
});
