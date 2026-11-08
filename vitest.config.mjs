import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    deps: {},
    // Resolved by vite, so it shares the tests' `graphql` (the development build).
    server: { deps: { inline: ['@graphql-tools/executor'] } },
    exclude: [
      'packages/plugin-authz/**/*',
      'packages/plugin-federation/**/*',
      'packages/plugin-directives/**/*',
      '**/node_modules/**',
    ],
    typecheck: {
      enabled: true,
      checker: 'tsc',
      tsconfig: 'tsconfig.type.json',
    },
  },
});
