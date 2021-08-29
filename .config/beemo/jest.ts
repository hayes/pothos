import { JestConfig } from '@beemo/driver-jest';

const config: JestConfig = {
  timers: 'real',
  coveragePathIgnorePatterns: ['src/index.ts'],
  setupFilesAfterEnv: [],
};

export default config;
