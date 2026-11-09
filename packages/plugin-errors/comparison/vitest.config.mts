import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const variants = {
  direct: '../src/subscription-iterator.ts',
  'direct-refined': './subscription-iterator.direct.ts',
  generator: './subscription-iterator.generator.ts',
  'sync-generator': './subscription-iterator.sync-generator.ts',
  'stream-generator': './subscription-iterator.stream-generator.ts',
};
const variant = process.env.POTHOS_ITERATOR_VARIANT ?? 'generator';
if (!(variant in variants)) {
  throw new Error(`Unknown iterator variant: ${variant}`);
}

export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  resolve: {
    alias: [
      {
        find: /^\.{1,2}\/(?:src\/)?subscription-iterator(?:\.js)?$/,
        replacement: fileURLToPath(
          new URL(variants[variant as keyof typeof variants], import.meta.url),
        ),
      },
      ...(process.env.POTHOS_ITERATOR_GRAPHQL
        ? [{ find: /^graphql$/, replacement: process.env.POTHOS_ITERATOR_GRAPHQL }]
        : []),
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/plugin-errors/tests/**/*.test.ts',
      'packages/plugin-errors/comparison/contract.compare.ts',
    ],
    testTimeout: 1_000,
  },
});
