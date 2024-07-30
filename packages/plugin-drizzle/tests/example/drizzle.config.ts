import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './tests/example/db/schema.ts',
  out: './tests/example/drizzle',
  dbCredentials: {
    url: `file:./tests/example/db/dev.db`,
  },
});
