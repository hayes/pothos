import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    deps: {},
    exclude: [
      'packages/plugin-authz/**/*',
      'packages/plugin-federation/**/*',
      'packages/plugin-directives/**/*',
      '**/node_modules/**',
    ],
    typecheck: {
      enabled: true,
      tsconfig: 'tsconfig.type.json',
    },
  },
});
