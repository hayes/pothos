import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Resolved by vite, so it shares the test's `graphql` (the development build).
    server: { deps: { inline: ['@graphql-tools/executor'] } },
    typecheck: {
      enabled: true,
      checker: 'tsc',
      tsconfig: 'tsconfig.type.json',
    },
  },
});
