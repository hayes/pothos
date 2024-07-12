import { Config } from 'drizzle-kit';

export default {
  schema: './tests/example/db/schema.ts',
  out: './tests/drizzle',
  dbCredentials: {
    url: './tests/example/db/dev.db',
  },
  driver: 'better-sqlite',
} satisfies Config;
