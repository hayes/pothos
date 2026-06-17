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
      // The repo type-checks with tsgo (@typescript/native-preview); vitest defaults to spawning
      // `tsc`, which isn't installed (typescript ships `tsc6`). Point it at tsgo.
      checker: 'tsgo',
      tsconfig: 'tsconfig.type.json',
    },
  },
});
