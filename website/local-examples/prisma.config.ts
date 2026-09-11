import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // migrate diff uses the dialect configuration, without opening this file.
  // The runner creates its own temporary database through the driver adapter.
  datasource: { url: 'file:./prisma/generated/development.db' },
});
