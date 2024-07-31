import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './tests/example/db/schema.ts',
  out: './tests/drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './tests/example/db/dev.db',
  },
});
