import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

// graphql 17 ships dual ESM/CJS builds; loading more than one (e.g. the schema via CJS and
// @graphql-tools/@apollo via ESM) trips graphql's cross-realm instance check. Pin every importer
// to the single resolved graphql module and inline the graphql-touching deps so the alias reaches
// them too.
const graphqlEntry = createRequire(import.meta.url).resolve('graphql');

export default defineConfig({
  resolve: {
    alias: { graphql: graphqlEntry },
    dedupe: ['graphql'],
  },
  test: {
    environment: 'node',
    globals: true,
    server: { deps: { inline: [/@graphql-tools/, /@envelop/, /@apollo/] } },
    deps: {},
    exclude: [
      'packages/plugin-authz/**/*',
      'packages/plugin-federation/**/*',
      'packages/plugin-directives/**/*',
      '**/node_modules/**',
    ],
    typecheck: {
      enabled: true,
      checker: 'tsgo',
      tsconfig: 'tsconfig.type.json',
    },
  },
});
