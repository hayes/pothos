import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.mjs';

// The test files share one Postgres schema, and tests/codegen.test.ts writes rows that the
// snapshot queries in the other files would pick up, so run the files one at a time.
export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      fileParallelism: false,
    },
  }),
);
